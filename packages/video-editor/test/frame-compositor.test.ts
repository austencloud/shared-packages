import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	POST_STUDIO_ROLE,
	compilePostProject,
	createProjectSchema,
	normalizeProject,
} from "../src/core/index.js";
import {
	createPainterRegistry,
	evaluatePresetLayers,
	isVisibleLayer,
	renderPostStudioFrame,
	textPainterFactory,
} from "../src/render/index.js";
import type {
	EvaluatedFrameLayer,
	PostStudioLayerPainter,
	SurfaceCapture,
} from "../src/render/index.js";
import plain from "./fixtures/plain.project.json";

// These tests need no plugin: the plain fixture is media and text, and the compositor draws
// both from the core alone. The package's shared canvas stand-in has no save, restore or
// fillText, so each test brings a recording canvas of its own and the file runs under the unit
// project.

const project = normalizeProject(createProjectSchema().parse(plain));
const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
if (!compiled) throw new Error("the plain fixture must compile");
const { preset, durationSeconds } = compiled;

// At 2.5 seconds the fixture shows its first video and the text t1, and nothing else.
const TIME = 2.5;

interface Call {
	name: string;
	args: unknown[];
}

interface RecordingCanvas {
	canvas: HTMLCanvasElement;
	calls: Call[];
	count(name: string): number;
}

/** A 2D canvas that remembers every method call and keeps assigned properties as they were set. */
function recordingCanvas(width: number, height: number): RecordingCanvas {
	const calls: Call[] = [];
	const values: Record<string, unknown> = { globalAlpha: 1 };
	const methods = new Map<string, (...args: unknown[]) => unknown>();
	const canvas = { width, height } as HTMLCanvasElement;
	const context: unknown = new Proxy(
		{},
		{
			get(_target, property) {
				if (typeof property !== "string") return undefined;
				if (property === "canvas") return canvas;
				if (property in values) return values[property];
				let method = methods.get(property);
				if (!method) {
					method = (...args: unknown[]) => {
						calls.push({ name: property, args });
						if (property === "measureText") return { width: String(args[0]).length * 10 };
						if (property.startsWith("create")) return { addColorStop: () => undefined };
						return undefined;
					};
					methods.set(property, method);
				}
				return method;
			},
			set(_target, property, value) {
				if (typeof property === "string") values[property] = value;
				return true;
			},
		},
	);
	canvas.getContext = (() => context) as unknown as HTMLCanvasElement["getContext"];
	return { canvas, calls, count: (name) => calls.filter((call) => call.name === name).length };
}

function layersAt(time: number): EvaluatedFrameLayer[] {
	return evaluatePresetLayers(preset, durationSeconds, time, null).filter(isVisibleLayer);
}

function regionLabel(layer: EvaluatedFrameLayer): string {
	const region = preset.regions.find((candidate) => candidate.id === layer.regionId);
	return region?.label ?? layer.sourceRole;
}

const textRoles = new Set(compiled.texts.map((text) => text.role));
const painters = createPainterRegistry([textPainterFactory]).paintersFor({ project, compiled });
const layers = layersAt(TIME);
const mediaLayer = layers.find((layer) => !textRoles.has(layer.sourceRole));
if (!mediaLayer) throw new Error("the plain fixture must show a media layer at 2.5 seconds");
const textLayer = layers.find((layer) => textRoles.has(layer.sourceRole));
if (!textLayer) throw new Error("the plain fixture must show a text layer at 2.5 seconds");

/** The preview's mounted layer for the media clip, holding a picture the compositor can read. */
function mount(renderMode?: string): { root: HTMLElement; picture: HTMLImageElement } {
	const root = document.body;
	root.innerHTML = `<div class="media-layer" data-clip-id="${mediaLayer!.clipId}"><img></div>`;
	const element = root.querySelector<HTMLElement>(".media-layer")!;
	if (renderMode !== undefined) element.dataset.renderMode = renderMode;
	const picture = root.querySelector("img")!;
	// jsdom decodes nothing, so the picture's size and readiness are stated.
	Object.defineProperty(picture, "naturalWidth", { value: 800 });
	Object.defineProperty(picture, "naturalHeight", { value: 1000 });
	Object.defineProperty(picture, "complete", { value: true });
	return { root, picture };
}

/** The media layer under a role of the core's choosing, in the preset and in the layer list. */
function withMediaRole(role: string): {
	preset: typeof preset;
	layers: EvaluatedFrameLayer[];
} {
	return {
		preset: {
			...preset,
			clips: preset.clips.map((clip) =>
				clip.kind === "visual" && clip.id === mediaLayer!.clipId
					? { ...clip, sourceRole: role }
					: clip,
			),
		},
		layers: layers.map((layer) =>
			layer.clipId === mediaLayer!.clipId ? { ...layer, sourceRole: role } : layer,
		),
	};
}

function frameInput(output: RecordingCanvas, root: HTMLElement) {
	return {
		canvas: output.canvas,
		root,
		preset,
		layers,
		surfaceCache: new Map<string, HTMLCanvasElement>(),
		painters,
		timeSeconds: TIME,
	};
}

describe("renderPostStudioFrame with no plugin", () => {
	let samples: RecordingCanvas[];

	beforeEach(() => {
		// jsdom has no CSS.escape, which the compositor uses to find a clip's layer element.
		vi.stubGlobal("CSS", {
			escape: (value: string) =>
				value.replace(/[^a-zA-Z0-9_-]/g, (character) => String.fromCharCode(92) + character),
		});
		// The blurred backdrop keeps a small canvas of its own; it gets a recording one too.
		samples = [];
		const createElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
			if (tag.toLowerCase() !== "canvas") return createElement(tag);
			const sample = recordingCanvas(0, 0);
			samples.push(sample);
			return sample.canvas;
		}) as typeof document.createElement);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		document.body.innerHTML = "";
	});

	it("draws the media and the text of the plain fixture", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root, picture } = mount();

		await renderPostStudioFrame(frameInput(output, root));

		const drawnPictures = output.calls.filter(
			(call) => call.name === "drawImage" && call.args[0] === picture,
		);
		expect(drawnPictures).toHaveLength(1);
		const text = compiled!.texts.find((entry) => entry.role === textLayer!.sourceRole);
		expect(text?.text).toBeTruthy();
		const drawnText = output.calls.filter((call) => call.name === "fillText");
		expect(drawnText.map((call) => call.args[0])).toEqual([text?.text]);
		// The blurred backdrop drew the same picture into its own sample canvas.
		expect(samples.some((sample) => sample.calls.some((call) => call.args[0] === picture))).toBe(
			true,
		);
		expect(output.count("save")).toBe(output.count("restore"));
	});

	it("throws, naming the layer's region, for a DOM render mode with no surface", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root } = mount("sequence-animation");

		const failure = renderPostStudioFrame(frameInput(output, root));

		await expect(failure).rejects.toThrow(
			`The ${regionLabel(mediaLayer!)} layer has no surface for its sequence-animation render mode.`,
		);
	});

	it("throws for a painted layer that has no painter, naming the layer's region", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root, picture } = mount();
		const carousel = withMediaRole(POST_STUDIO_ROLE.carousel);

		const failure = renderPostStudioFrame({
			...frameInput(output, root),
			preset: carousel.preset,
			layers: carousel.layers,
		});

		await expect(failure).rejects.toThrow(
			`No painter for the ${regionLabel(mediaLayer!)} layer (painted mode).`,
		);
		// The media branch never ran: nothing drew the mounted picture into the layer.
		expect(output.calls.some((call) => call.args[0] === picture)).toBe(false);
	});

	it("throws for a layer its element marks painted when no painter answers its role", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root, picture } = mount("painted");

		const failure = renderPostStudioFrame(frameInput(output, root));

		await expect(failure).rejects.toThrow(
			`No painter for the ${regionLabel(mediaLayer!)} layer (painted mode).`,
		);
		expect(output.calls.some((call) => call.args[0] === picture)).toBe(false);
	});

	it("paints a painted layer through its painter when one answers", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root } = mount();
		const carousel = withMediaRole(POST_STUDIO_ROLE.carousel);
		const painter: PostStudioLayerPainter = {
			prepare: vi.fn(async () => undefined),
			paint: vi.fn(),
		};

		await renderPostStudioFrame({
			...frameInput(output, root),
			preset: carousel.preset,
			layers: carousel.layers,
			painters: new Map([...painters, [POST_STUDIO_ROLE.carousel, painter]]),
		});

		expect(painter.prepare).toHaveBeenCalledTimes(1);
		expect(painter.paint).toHaveBeenCalledTimes(1);
		expect(output.count("save")).toBe(output.count("restore"));
	});

	it("restores the context when a surface's draw throws", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root } = mount("x");
		const draw = vi.fn(async () => {
			throw new Error("surface draw failed");
		});
		const surface: SurfaceCapture = { renderMode: "x", draw };

		const failure = renderPostStudioFrame({ ...frameInput(output, root), surfaces: [surface] });

		await expect(failure).rejects.toThrow("surface draw failed");
		expect(draw).toHaveBeenCalledTimes(1);
		expect(output.count("save")).toBeGreaterThan(0);
		expect(output.count("restore")).toBe(output.count("save"));
	});

	it("hands a surface the layer element and leaves the context balanced when it draws", async () => {
		const output = recordingCanvas(preset.output.width, preset.output.height);
		const { root } = mount("x");
		const draw = vi.fn(async () => undefined);

		await renderPostStudioFrame({
			...frameInput(output, root),
			surfaces: [{ renderMode: "x", draw }],
		});

		expect(draw).toHaveBeenCalledTimes(1);
		const [drawInput] = draw.mock.calls[0] as unknown as [{ layerElement: HTMLElement }];
		expect(drawInput.layerElement).toBe(root.querySelector(".media-layer"));
		expect(output.count("restore")).toBe(output.count("save"));
	});
});
