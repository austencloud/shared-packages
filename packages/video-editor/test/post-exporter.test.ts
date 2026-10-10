import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { compilePostProject, createProjectSchema, normalizeProject } from "../src/core/index.js";
import {
	PostStudioExportVideoFrames,
	exportPostStudioVideo,
	renderPostStudioFrame,
} from "../src/render/index.js";
import type { ExportPostStudioVideoInput, SurfaceCapture } from "../src/render/index.js";
import plain from "./fixtures/plain.project.json";

// The encoder needs WebCodecs and the compositor needs a canvas that draws; neither is what is
// under test. The exporter's own order of work is: set up, render each frame, encode, and
// always dispose the decoder and release every surface.
const encoders = vi.hoisted(() => [] as { cancel: () => void; finish: () => Promise<Blob> }[]);

vi.mock("../src/encoder/background-video-encoder.js", () => ({
	BackgroundVideoEncoder: class {
		onProgress: ((frameIndex: number) => void) | null = null;
		initialize = vi.fn(async () => undefined);
		addFrameCaptured = vi.fn();
		waitForFrameQueue = vi.fn(async () => undefined);
		finish = vi.fn(async () => new Blob(["mp4"]));
		cancel = vi.fn();
		constructor() {
			encoders.push(this);
		}
	},
}));
vi.mock("../src/encoder/canvas-frame-capturer.js", () => ({
	CanvasFrameCapturer: class {
		capture = vi.fn(() => ({}));
	},
}));
vi.mock("../src/render/frame-compositor.js", () => ({
	renderPostStudioFrame: vi.fn(async () => undefined),
}));

const project = normalizeProject(createProjectSchema().parse(plain));
const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
if (!compiled) throw new Error("the plain fixture must compile");

// 30 frames a second: this is three frames.
const SHORT = 0.1;

interface FakeSurface extends SurfaceCapture {
	draw: Mock<SurfaceCapture["draw"]>;
	release: Mock<() => void>;
}

function fakeSurface(release: () => void = () => undefined): FakeSurface {
	return { renderMode: "x", draw: vi.fn(async () => undefined), release: vi.fn(release) };
}

function exportInput(
	overrides: Partial<ExportPostStudioVideoInput> = {},
): ExportPostStudioVideoInput {
	return {
		root: document.body,
		preset: compiled!.preset,
		durationSeconds: SHORT,
		getLayers: () => [],
		seek: vi.fn(),
		...overrides,
	};
}

describe("exportPostStudioVideo with no plugin", () => {
	beforeEach(() => {
		encoders.length = 0;
		vi.mocked(renderPostStudioFrame).mockReset();
		vi.mocked(renderPostStudioFrame).mockResolvedValue(undefined);
		// Two animation frames a frame, run at once.
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			queueMicrotask(() => callback(0));
			return 0;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("renders every frame, finishes the encoder and releases each surface once on success", async () => {
		const surface = fakeSurface();

		const blob = await exportPostStudioVideo(exportInput({ surfaces: [surface] }));

		expect(blob).toBeInstanceOf(Blob);
		expect(renderPostStudioFrame).toHaveBeenCalledTimes(3);
		expect(surface.release).toHaveBeenCalledTimes(1);
		expect(encoders[0]?.cancel).not.toHaveBeenCalled();
	});

	it("releases each surface once and cancels the encoder when a frame throws", async () => {
		const surface = fakeSurface();
		vi.mocked(renderPostStudioFrame).mockRejectedValueOnce(new Error("frame failed"));

		const failure = exportPostStudioVideo(exportInput({ surfaces: [surface] }));

		await expect(failure).rejects.toThrow("frame failed");
		expect(surface.release).toHaveBeenCalledTimes(1);
		expect(encoders[0]?.cancel).toHaveBeenCalledTimes(1);
	});

	it("releases each surface once when the signal aborts mid export", async () => {
		const surface = fakeSurface();
		const controller = new AbortController();
		vi.mocked(renderPostStudioFrame).mockImplementationOnce(async () => {
			controller.abort();
		});

		const failure = exportPostStudioVideo(
			exportInput({ surfaces: [surface], signal: controller.signal }),
		);

		await expect(failure).rejects.toThrow("Export cancelled");
		expect(surface.release).toHaveBeenCalledTimes(1);
		expect(renderPostStudioFrame).toHaveBeenCalledTimes(1);
		expect(encoders[0]?.cancel).toHaveBeenCalledTimes(1);
	});

	it("disposes the decoder before it releases, and a release that throws stops nothing", async () => {
		const dispose = vi.spyOn(PostStudioExportVideoFrames.prototype, "dispose");
		const failing = fakeSurface(() => {
			throw new Error("release failed");
		});
		const after = fakeSurface();
		vi.mocked(renderPostStudioFrame).mockRejectedValueOnce(new Error("frame failed"));

		const failure = exportPostStudioVideo(exportInput({ surfaces: [failing, after] }));

		// The caller sees the frame's own error, never the release's.
		await expect(failure).rejects.toThrow("frame failed");
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(failing.release).toHaveBeenCalledTimes(1);
		expect(after.release).toHaveBeenCalledTimes(1);
		const disposedAt = dispose.mock.invocationCallOrder[0]!;
		expect(disposedAt).toBeLessThan(failing.release.mock.invocationCallOrder[0]!);
	});

	it("still returns the file when a release throws after a good export", async () => {
		const dispose = vi.spyOn(PostStudioExportVideoFrames.prototype, "dispose");
		const failing = fakeSurface(() => {
			throw new Error("release failed");
		});

		const blob = await exportPostStudioVideo(exportInput({ surfaces: [failing] }));

		expect(blob).toBeInstanceOf(Blob);
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(failing.release).toHaveBeenCalledTimes(1);
	});

	it("rejects a zero duration with a RangeError and still releases the surfaces", async () => {
		const surface = fakeSurface();

		const failure = exportPostStudioVideo(exportInput({ durationSeconds: 0, surfaces: [surface] }));

		await expect(failure).rejects.toThrow(new RangeError("Post duration must be positive"));
		await expect(failure).rejects.toBeInstanceOf(RangeError);
		expect(surface.release).toHaveBeenCalledTimes(1);
		expect(renderPostStudioFrame).not.toHaveBeenCalled();
	});

	it("releases the surfaces when the setup throws", async () => {
		const surface = fakeSurface();
		const createElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
			if (tag.toLowerCase() === "canvas") throw new Error("no canvas");
			return createElement(tag);
		}) as typeof document.createElement);

		const failure = exportPostStudioVideo(exportInput({ surfaces: [surface] }));

		await expect(failure).rejects.toThrow("no canvas");
		expect(surface.release).toHaveBeenCalledTimes(1);
		expect(encoders).toHaveLength(0);
	});
});
