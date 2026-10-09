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
});
