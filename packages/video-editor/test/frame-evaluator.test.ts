import { describe, expect, it, vi } from "vitest";
import { compilePostProject, createProjectSchema, normalizeProject } from "../src/core/index.js";
import type { TakeSample } from "../src/core/index.js";
import { evaluatePresetLayers } from "../src/render/index.js";
import type { FrameAlignment } from "../src/render/index.js";
import plain from "./fixtures/plain.project.json";

const project = normalizeProject(createProjectSchema().parse(plain));
const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
if (!compiled) throw new Error("the plain fixture must compile");
const { preset, durationSeconds } = compiled;

// The plain fixture, by time: 0.2 has v1 alone; 2.5 has v1 and a text; 4.9 has v1, v2 and an image;
// 7 has v2, a text and a faded image. The two videos are the only clips that read a take clock.
const TIMES = [0.2, 2.5, 4.9, 7, 9.6, 11];

const ALIGNMENT_KEYS = [
	"sequenceFrame",
	"sequencePosition",
	"sequencePassIndex",
	"carouselPosition",
	"animationTimeSeconds",
	"displayedBeatNumber",
] as const;

const SAMPLE: TakeSample = { arrival: 1.5, endArrival: 3 };

function alignmentWith(
	moveBeats: readonly number[],
	sampleFor: (role: string) => TakeSample | null,
	frameFields = vi.fn((): Record<string, never> => ({})),
) {
	const roles = preset.clips.flatMap((clip) =>
		clip.kind === "visual" && clip.useResolvedTimeMap && clip.timeMapRole !== undefined
			? [clip.timeMapRole]
			: [],
	);
	const clocks = Object.fromEntries(
		roles.map((role) => [role, { sampleAt: () => sampleFor(role) }]),
	);
	const alignment: FrameAlignment = { moveBeats, clocks, frameFields };
	return { alignment, frameFields, roles };
}

describe("evaluatePresetLayers alignment seam", () => {
	it("adds no sequence field to any layer when there is no alignment", () => {
		let layerCount = 0;
		for (const time of TIMES) {
			for (const layer of evaluatePresetLayers(preset, durationSeconds, time, null)) {
				layerCount += 1;
				for (const key of ALIGNMENT_KEYS) expect(layer).not.toHaveProperty(key);
			}
		}
		expect(layerCount).toBeGreaterThan(0);
	});

	it("calls frameFields only for layers that got a sample, with the alignment's moveBeats", () => {
		const moveBeats = [1, 2, 1];
		// take:a is mapped and take:b answers null, so a layer exists that has no sample either way.
		const { alignment, frameFields, roles } = alignmentWith(moveBeats, (role) =>
			role === "take:a" ? SAMPLE : null,
		);
		expect(roles).toEqual(["take:a", "take:b"]);

		// At 4.9 three layers are on screen (v1, v2, i1); only v1 has a sample.
		const layers = evaluatePresetLayers(preset, durationSeconds, 4.9, alignment);
		expect(layers.map((layer) => layer.clipId)).toEqual(["v1", "v2", "i1"]);
		expect(frameFields).toHaveBeenCalledTimes(1);
		const [sample, beats, holdLandings] = frameFields.mock.calls[0] as unknown as [
			TakeSample,
			readonly number[],
			boolean,
		];
		expect(sample).toBe(SAMPLE);
		expect(beats).toBe(moveBeats);
		expect(holdLandings).toBe(false);

		// Across the whole run: one call per layer whose clip reads a mapped clock, and no more.
		frameFields.mockClear();
		let sampledLayers = 0;
		for (const time of TIMES) {
			const evaluated = evaluatePresetLayers(preset, durationSeconds, time, alignment);
			sampledLayers += evaluated.filter((layer) => layer.sourceRole === "take:a").length;
		}
		expect(sampledLayers).toBeGreaterThan(0);
		expect(frameFields).toHaveBeenCalledTimes(sampledLayers);
		for (const call of frameFields.mock.calls) {
			expect((call as unknown[])[1]).toBe(moveBeats);
		}
	});

	it("never calls frameFields when moveBeats is empty", () => {
		const { alignment, frameFields } = alignmentWith([], () => SAMPLE);
		for (const time of TIMES) {
			const layers = evaluatePresetLayers(preset, durationSeconds, time, alignment);
			expect(layers.length).toBeGreaterThan(0);
		}
		expect(frameFields).not.toHaveBeenCalled();
	});
});
