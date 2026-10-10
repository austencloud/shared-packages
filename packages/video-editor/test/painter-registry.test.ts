import { describe, expect, it, vi } from "vitest";
import { compilePostProject, createProjectSchema, normalizeProject } from "../src/core/index.js";
import { createPainterRegistry } from "../src/render/index.js";
import type { PainterEnv, PainterFactory, PostStudioLayerPainter } from "../src/render/index.js";
import plain from "./fixtures/plain.project.json";

const project = normalizeProject(createProjectSchema().parse(plain));
const compiled = compilePostProject(project, { now: project.updatedAt, animationOverlay: false });
if (!compiled) throw new Error("the plain fixture must compile");
const env: PainterEnv = { project, compiled };

const roles = compiled.preset.clips.map((clip) => clip.sourceRole);
const [role] = roles;
if (role === undefined) throw new Error("the plain fixture must have clips");

function painter(): PostStudioLayerPainter {
	return { prepare: async () => {}, paint: () => {} };
}

describe("createPainterRegistry", () => {
	it("takes the first non-null painter for a role and does not ask later factories", () => {
		const fromA = painter();
		const fromB = painter();
		const a: PainterFactory = {
			id: "a",
			create: vi.fn((asked) => (asked === role ? fromA : null)),
		};
		const b: PainterFactory = { id: "b", create: vi.fn(() => fromB) };

		const painters = createPainterRegistry([a, b]).paintersFor(env);

		expect(painters.get(role)).toBe(fromA);
		// b never saw the role a answered, and answers every other role.
		const askedOfB = (b.create as ReturnType<typeof vi.fn>).mock.calls.map(([asked]) => asked);
		expect(askedOfB).not.toContain(role);
		for (const other of new Set(roles)) {
			if (other !== role) expect(painters.get(other)).toBe(fromB);
		}
	});

	it("asks the factories once per role when clips repeat a role", () => {
		// The plain fixture has one clip per role, so the clips are listed twice.
		const repeated = {
			...compiled,
			preset: { ...compiled.preset, clips: [...compiled.preset.clips, ...compiled.preset.clips] },
		};
		const create = vi.fn(() => painter());

		const painters = createPainterRegistry([{ id: "only", create }]).paintersFor({
			project,
			compiled: repeated,
		});

		const distinct = new Set(roles);
		expect(repeated.preset.clips.length).toBe(roles.length * 2);
		expect(create).toHaveBeenCalledTimes(distinct.size);
		expect(painters.size).toBe(distinct.size);
		const askedRoles = create.mock.calls.map((call) => (call as unknown[])[0]);
		expect(new Set(askedRoles).size).toBe(distinct.size);
	});

	it("leaves a role no factory answers out of the map, and asks again for every clip that repeats it", () => {
		// Pins today's behaviour: a null answer is not remembered, so the registry has no
		// 'unanswered' cache and each clip carrying the role asks every factory once more.
		const repeated = {
			...compiled,
			preset: { ...compiled.preset, clips: [...compiled.preset.clips, ...compiled.preset.clips] },
		};
		const first = { id: "first", create: vi.fn((): PostStudioLayerPainter | null => null) };
		const second = { id: "second", create: vi.fn((): PostStudioLayerPainter | null => null) };

		const painters = createPainterRegistry([first, second]).paintersFor({
			project,
			compiled: repeated,
		});

		expect(painters.size).toBe(0);
		expect(painters.get(role)).toBeUndefined();
		expect(first.create).toHaveBeenCalledTimes(repeated.preset.clips.length);
		expect(second.create).toHaveBeenCalledTimes(repeated.preset.clips.length);
		const askedOfFirst = first.create.mock.calls.filter((call) => (call as unknown[])[0] === role);
		expect(askedOfFirst).toHaveLength(roles.filter((candidate) => candidate === role).length * 2);
	});

	it("asks again on every paintersFor call and builds a fresh painter each time", () => {
		const create = vi.fn(() => painter());
		const registry = createPainterRegistry([{ id: "only", create }]);

		const one = registry.paintersFor(env);
		const two = registry.paintersFor(env);

		expect(create).toHaveBeenCalledTimes(new Set(roles).size * 2);
		expect(two.get(role)).not.toBe(one.get(role));
	});

	it("gives every role to the first of two factories that both answer it", () => {
		const fromFirst = painter();
		const fromSecond = painter();
		const first: PainterFactory = { id: "first", create: vi.fn(() => fromFirst) };
		const second: PainterFactory = { id: "second", create: vi.fn(() => fromSecond) };

		const painters = createPainterRegistry([first, second]).paintersFor(env);

		for (const answered of new Set(roles)) expect(painters.get(answered)).toBe(fromFirst);
		expect(second.create).not.toHaveBeenCalled();
		// The order is the whole rule: swap the factories and the other one wins.
		const swapped = createPainterRegistry([second, first]).paintersFor(env);
		for (const answered of new Set(roles)) expect(swapped.get(answered)).toBe(fromSecond);
	});
});
