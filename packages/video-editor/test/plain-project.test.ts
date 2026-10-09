import { describe, expect, it } from "vitest";
import { compilePostProject, createProjectSchema, normalizeProject } from "../src/core/index.js";
import { evaluatePresetLayers, isVisibleLayer } from "../src/render/index.js";
import plain from "./fixtures/plain.project.json";

// The fixture is tka's plain parity project with `sequenceId` renamed to the core's `subjectId`:
// the plugin-free schema is strict and rejects the tka project-extension key. It is imported, not
// read with fs, because import.meta.url is not a file URL under the jsdom environment.
const stored: unknown = plain;

describe("plain project without a plugin", () => {
	it("parses, normalizes, compiles and evaluates with the core alone", () => {
		const project = normalizeProject(createProjectSchema().parse(stored));
		const compiled = compilePostProject(project, {
			now: project.updatedAt,
			animationOverlay: false,
		});
		expect(compiled).not.toBeNull();
		if (!compiled) return;
		for (const time of [0.2, 2.5, 4.9, 7, Math.max(0, compiled.durationSeconds - 0.4)]) {
			const layers = evaluatePresetLayers(compiled.preset, compiled.durationSeconds, time, null);
			expect(layers.filter(isVisibleLayer).length).toBeGreaterThan(0);
		}
	});
});
