import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	createEmptyPostProject,
	createProjectSchema,
	orderedShape,
} from "../src/core/index.js";

const base = { a: z.string(), b: z.number() };
const extension = { c: z.boolean() };

describe("orderedShape", () => {
	it("puts the base keys first and the extension keys after them when there is no order", () => {
		expect(Object.keys(orderedShape(base, extension, undefined))).toEqual(["a", "b", "c"]);
		expect(Object.keys(orderedShape(base, undefined, undefined))).toEqual(["a", "b"]);
	});

	it("honours an order and keeps each key's schema", () => {
		const shape = orderedShape(base, extension, ["c", "a", "b"]);
		expect(Object.keys(shape)).toEqual(["c", "a", "b"]);
		expect(shape.a).toBe(base.a);
		expect(shape.c).toBe(extension.c);
	});

	it("throws when the order leaves out a merged key", () => {
		expect(() => orderedShape(base, extension, ["a", "c"])).toThrow(
			"shape order mismatch: missing b, extra none",
		);
	});

	it("throws when the order names a key the shape does not have", () => {
		expect(() => orderedShape(base, extension, ["a", "b", "c", "d"])).toThrow(
			"shape order mismatch: missing none, extra d",
		);
	});

	it("does not take a prototype key such as toString for a shape key", () => {
		expect(() => orderedShape(base, extension, ["a", "b", "c", "toString"])).toThrow(
			"shape order mismatch: missing none, extra toString",
		);
	});

	it("throws when an extension key already exists in the base", () => {
		expect(() => orderedShape(base, { a: z.number() }, undefined)).toThrow(
			'shape extension overrides core key "a"',
		);
		expect(() => orderedShape(base, { c: z.string(), b: z.string() }, ["a", "b", "c"])).toThrow(
			'shape extension overrides core key "b"',
		);
	});
});

describe("createProjectSchema without a plugin", () => {
	const schema = createProjectSchema();

	it("parses an empty project back to the same JSON", () => {
		const project = createEmptyPostProject({ now: 1 });
		expect(JSON.stringify(schema.parse(project))).toBe(JSON.stringify(project));
	});

	const withItem = (item: unknown) => {
		const project = createEmptyPostProject({ now: 1 });
		(project.tracks[0] as { items: unknown[] }).items = [item];
		return project;
	};
	const messages = (project: unknown) => {
		const result = schema.safeParse(project);
		expect(result.success).toBe(false);
		return result.success ? "" : result.error.issues.map((issue) => issue.message).join("\n");
	};

	it("names the kind of an item no schema knows", () => {
		expect(messages(withItem({ kind: "animation" }))).toContain('Unknown post item kind "animation"');
	});

	it("leaves zod's own message for an item that is not an object", () => {
		const text = messages(withItem(42));
		expect(text).not.toContain("Unknown post item kind");
		expect(text.length).toBeGreaterThan(0);
	});
});
