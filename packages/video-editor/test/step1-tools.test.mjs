import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { barrelImports, definersIn, placeText } from "../scripts/step1/lib.mjs";

const NL = String.fromCharCode(10);
const lines = (...rows) => rows.join(NL) + NL;
const roots = [];
after(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function tree(files) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "step1-tools-")).split(path.sep).join("/");
	roots.push(root);
	for (const [name, text] of Object.entries(files)) {
		fs.mkdirSync(path.posix.dirname(`${root}/${name}`), { recursive: true });
		fs.writeFileSync(`${root}/${name}`, text);
	}
	return root;
}

// A package as it stands after earlier moves: a core barrel over two moved files, a file that
// re-exports a name under another one, and a constant only the barrel declares.
const CORE = {
	"src/index.ts": lines('export * from "./core/index.js";'),
	"src/core/index.ts": lines(
		'export * from "./plan/post-plan.js";',
		'export * from "./tunnel-hook.js";',
		'export * from "./preset/source-schema.js";',
		'export const VERSION = "1";',
	),
	"src/core/plan/post-plan.ts": lines(
		"export const PostTakeSchema = 1;",
		"export type PostTake = { id: string };",
		"export function compilePlan(): void {}",
	),
	"src/core/tunnel-hook.ts": lines(
		"export interface TunnelHook { at: number }",
		"export const tunnelHookAt = 2;",
	),
	"src/core/preset/source-schema.ts": lines(
		'export { tunnelHookAt as hookAt } from "../tunnel-hook.js";',
	),
};

function place(root, text, to = "core/project/schema.ts") {
	return placeText({
		text,
		source: "E:/tka/src/lib/shared/media-composition/domain/post-project.ts",
		to,
		root,
		entries: { "@austencloud/video-editor/core": `${root}/src/core/index.ts` },
	});
}

test("definersIn maps names to declaring files, then to re-exporting files", () => {
	const root = tree(CORE);
	const lookup = definersIn(`${root}/src/core`, new Set([`${root}/src/core/index.ts`]));
	assert.deepEqual(lookup("PostTake"), [`${root}/src/core/plan/post-plan.ts`]);
	assert.deepEqual(lookup("tunnelHookAt"), [`${root}/src/core/tunnel-hook.ts`]);
	assert.deepEqual(lookup("hookAt"), [`${root}/src/core/preset/source-schema.ts`]);
	assert.deepEqual(lookup("VERSION"), []);
});

test("an entry import becomes one import per defining file", () => {
	const root = tree(CORE);
	const result = place(
		root,
		lines(
			'import { PostTakeSchema, tunnelHookAt as at, type PostTake } from "@austencloud/video-editor/core";',
			'import type { TunnelHook } from "@austencloud/video-editor/core";',
			'import { hookAt } from "@austencloud/video-editor/core";',
			'export { compilePlan } from "@austencloud/video-editor/core";',
			'export type { PostTake as Take } from "@austencloud/video-editor/core";',
			'import { z } from "zod";',
		),
	);
	assert.equal(
		result.text,
		lines(
			'import { PostTakeSchema, type PostTake } from "../plan/post-plan.js";',
			'import { tunnelHookAt as at } from "../tunnel-hook.js";',
			'import type { TunnelHook } from "../tunnel-hook.js";',
			'import { hookAt } from "../preset/source-schema.js";',
			'export { compilePlan } from "../plan/post-plan.js";',
			'export type { PostTake as Take } from "../plan/post-plan.js";',
			'import { z } from "zod";',
		),
	);
	assert.deepEqual(result.unresolved, []);
	assert.equal(
		barrelImports(root, new Map([[`${root}/src/core/project/schema.ts`, result.text]])).length,
		0,
	);
});

test("a group of only inline type elements becomes import type or export type", () => {
	const root = tree(CORE);
	const result = place(
		root,
		lines(
			'import { type PostTake, type TunnelHook as Hook, tunnelHookAt } from "@austencloud/video-editor/core";',
			'export { type PostTake as Take, type TunnelHook } from "@austencloud/video-editor/core";',
			'import { PostTakeSchema, type PostTake as P } from "@austencloud/video-editor/core";',
		),
	);
	// Under verbatimModuleSyntax, import { type X } still emits a runtime import {} from "...", so a
	// group with no value left is written as import type; a mixed group keeps its inline modifiers.
	assert.equal(
		result.text,
		lines(
			'import type { PostTake } from "../plan/post-plan.js";',
			'import { type TunnelHook as Hook, tunnelHookAt } from "../tunnel-hook.js";',
			'export type { PostTake as Take } from "../plan/post-plan.js";',
			'export type { TunnelHook } from "../tunnel-hook.js";',
			'import { PostTakeSchema, type PostTake as P } from "../plan/post-plan.js";',
		),
	);
	assert.deepEqual(result.unresolved, []);
});

test("names no file exports and other entry forms stay as they are, listed as UNRESOLVED", () => {
	const root = tree(CORE);
	const text = lines(
		'import { PostTake, VERSION } from "@austencloud/video-editor/core";',
		'import * as core from "@austencloud/video-editor/core";',
		'const lazy = () => import("@austencloud/video-editor/core");',
	);
	const result = place(root, text);
	assert.equal(result.text, text);
	assert.deepEqual(result.unresolved, [
		"core/project/schema.ts: VERSION is exported by no package file (import from @austencloud/video-editor/core left as is)",
		'core/project/schema.ts: import * as core from "@austencloud/video-editor/core"; (only named imports and exports of an entry are split)',
		'core/project/schema.ts: import("@austencloud/video-editor/core") of an entry (point it at the file by hand)',
	]);
});

test("imports of placed tka modules become relative .js paths", () => {
	const root = tree(CORE);
	const result = placeText({
		text: lines('import { a } from "$lib/shared/x/moved";', 'import { b } from "./stays";'),
		source: "E:/worktrees/tka-platform/video-editor/src/lib/shared/x/source.ts",
		to: "render/source.ts",
		root,
		placed: new Map([["$lib/shared/x/moved", "core/moved.ts"]]),
		entries: {},
	});
	assert.equal(
		result.text,
		lines('import { a } from "../core/moved.js";', 'import { b } from "./stays";'),
	);
	assert.deepEqual(result.unresolved, ["render/source.ts: ./stays"]);
});

test("barrelImports flags a file importing a barrel of its own folder or the package by name", () => {
	const root = tree({
		...CORE,
		"src/core/plan/uses-core.ts": lines('import { VERSION } from "../index.js";'),
		"src/core/self.ts": lines('import { VERSION } from "./index.js";'),
		"src/core/by-name.ts": lines('import { VERSION } from "@austencloud/video-editor/core";'),
		"src/render/uses-core.ts": lines('import { VERSION } from "../core/index.js";'),
	});
	assert.deepEqual(barrelImports(root), [
		"src/core/by-name.ts:1: @austencloud/video-editor/core (the package importing itself by name)",
		"src/core/plan/uses-core.ts:1: ../index.js (a barrel of its own folder)",
		"src/core/self.ts:1: ./index.js (a barrel of its own folder)",
	]);
});
