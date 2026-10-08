import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

const STEP1 = new URL("../scripts/step1/", import.meta.url);
const stepScript = (name) => fileURLToPath(new URL(name, STEP1));
const ENCODER = "@austencloud/video-editor/encoder";
const CORE_ENTRY = "@austencloud/video-editor/core";
const RENDER_ENTRY = "@austencloud/video-editor/render";

// Runs rewrite-imports.mjs for task 4 over a fixture tka tree (STEP1_TKA), never over the real one.
function rewriteImports(files, { dry = false } = {}) {
	const root = tree(files);
	const args = [stepScript("rewrite-imports.mjs"), "--task", "4", ...(dry ? ["--dry"] : [])];
	const run = spawnSync(process.execPath, args, {
		encoding: "utf8",
		env: { ...process.env, STEP1_TKA: root },
	});
	return {
		root,
		status: run.status,
		stderr: run.stderr,
		out: run.stdout
			.split(NL)
			.map((row) => row.trimEnd())
			.filter(Boolean),
		read: (name) => fs.readFileSync(`${root}/${name}`, "utf8"),
	};
}

test("rewrite-imports merges value imports from one package entry into the first, in order", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { BackgroundVideoEncoder, selectCodec } from "${ENCODER}";`,
			'import { z } from "zod";',
			`import { CanvasFrameCapturer, encodeFrames } from "${ENCODER}";`,
			"export const used = [BackgroundVideoEncoder];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { BackgroundVideoEncoder, selectCodec, CanvasFrameCapturer, encodeFrames } from "${ENCODER}";`,
			'import { z } from "zod";',
			"export const used = [BackgroundVideoEncoder];",
		),
	);
	assert.deepEqual(run.out, ["changed 1 files"]);
});

test("rewrite-imports never merges a type import into a value import or the reverse", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { A } from "${ENCODER}";`,
			`import type { T1 } from "${ENCODER}";`,
			`import { B } from "${ENCODER}";`,
			`import type { T2 } from "${ENCODER}";`,
			"export const used = [A, B];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { A, B } from "${ENCODER}";`,
			`import type { T1, T2 } from "${ENCODER}";`,
			"export const used = [A, B];",
		),
	);
});

test("rewrite-imports lists a duplicate binding once and keeps inline type and as", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { selectCodec, type CodecChoice, encode as run } from "${ENCODER}";`,
			`import { selectCodec, type CodecChoice, type Frame as F, encode as run, encode } from "${ENCODER}";`,
			`import type { Size, Size as Dimensions } from "${ENCODER}";`,
			`import type { Size, Pixels } from "${ENCODER}";`,
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { selectCodec, type CodecChoice, encode as run, type Frame as F, encode } from "${ENCODER}";`,
			`import type { Size, Size as Dimensions, Pixels } from "${ENCODER}";`,
		),
	);
});

test("rewrite-imports leaves default, namespace and side-effect imports alone while merging the rest", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { A } from "${CORE_ENTRY}";`,
			`import Def, { X } from "${CORE_ENTRY}";`,
			`import * as ns from "${CORE_ENTRY}";`,
			`import "${CORE_ENTRY}";`,
			`import { B } from "${CORE_ENTRY}";`,
			`import type Kind from "${CORE_ENTRY}";`,
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { A, B } from "${CORE_ENTRY}";`,
			`import Def, { X } from "${CORE_ENTRY}";`,
			`import * as ns from "${CORE_ENTRY}";`,
			`import "${CORE_ENTRY}";`,
			`import type Kind from "${CORE_ENTRY}";`,
		),
	);
});

test("rewrite-imports merges inside each svelte script block and never across blocks", () => {
	const run = rewriteImports({
		"src/lib/Panel.svelte": lines(
			'<script context="module" lang="ts">',
			`\timport { A } from "${RENDER_ENTRY}";`,
			`\timport { B } from "${RENDER_ENTRY}";`,
			"</script>",
			"",
			'<script lang="ts">',
			`\timport { A } from "${RENDER_ENTRY}";`,
			`\timport type { C } from "${RENDER_ENTRY}";`,
			`\timport { D } from "${RENDER_ENTRY}";`,
			"</script>",
			"",
			"<p>{A}{B}{D}</p>",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/Panel.svelte"),
		lines(
			'<script context="module" lang="ts">',
			`\timport { A, B } from "${RENDER_ENTRY}";`,
			"</script>",
			"",
			'<script lang="ts">',
			`\timport { A, D } from "${RENDER_ENTRY}";`,
			`\timport type { C } from "${RENDER_ENTRY}";`,
			"</script>",
			"",
			"<p>{A}{B}{D}</p>",
		),
	);
});

test("rewrite-imports does not merge specifiers outside the package", () => {
	const run = rewriteImports(
		{
			"src/lib/a.ts": lines(
				'import { a } from "$lib/x";',
				'import { b } from "$lib/x";',
				'import { c } from "zod";',
				'import { d } from "zod";',
			),
		},
		{ dry: true },
	);
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(run.out, ["would change 0 files"]);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			'import { a } from "$lib/x";',
			'import { b } from "$lib/x";',
			'import { c } from "zod";',
			'import { d } from "zod";',
		),
	);
});

test("rewrite-imports keeps CRLF line endings when it merges", () => {
	const crlf = (...rows) => rows.join(String.fromCharCode(13, 10)) + String.fromCharCode(13, 10);
	const run = rewriteImports({
		"src/lib/a.ts": crlf(
			`import { A } from "${ENCODER}";`,
			'import { z } from "zod";',
			`import { B } from "${ENCODER}";`,
			"export const used = [A, B];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		crlf(
			`import { A, B } from "${ENCODER}";`,
			'import { z } from "zod";',
			"export const used = [A, B];",
		),
	);
});

test("a merge alone in a script is listed as a change, a dry run counts it, and it raises no ERROR", () => {
	const run = rewriteImports(
		{
			"scripts/tool.mjs": lines(
				`import { A } from "${ENCODER}";`,
				`import { B } from "${ENCODER}";`,
				"console.log(A, B);",
			),
		},
		{ dry: true },
	);
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(run.out, [`would change ${run.root}/scripts/tool.mjs`, "would change 1 files"]);
});

test("a script that imports a moved module still raises its ERROR", () => {
	const run = rewriteImports(
		{
			"scripts/tool.mjs": lines(
				'import { frameSize } from "$lib/shared/video-export/domain/captured-frame";',
			),
		},
		{ dry: true },
	);
	assert.equal(run.status, 1);
	assert.deepEqual(run.out, [
		`would change ${run.root}/scripts/tool.mjs`,
		"would change 1 files",
		`ERROR ${run.root}/scripts/tool.mjs: a script imports a moved module; check it still runs`,
	]);
});

test("rewrite-imports skips a file that is moving and still rewrites the files that import it", () => {
	const moving = lines(
		'import type { Encoded } from "$lib/shared/animation-engine/services/background-video-encoder";',
		'import { size } from "$lib/shared/video-export/services/canvas-frame-capturer";',
		`import { A } from "${ENCODER}";`,
		`import { B } from "${ENCODER}";`,
		"export const frameSize = [size, A, B];",
	);
	const run = rewriteImports({
		"src/lib/shared/video-export/domain/captured-frame.ts": moving,
		"src/lib/features/uses.ts": lines(
			'import { frameSize } from "$lib/shared/video-export/domain/captured-frame";',
			"export const used = frameSize;",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(run.read("src/lib/shared/video-export/domain/captured-frame.ts"), moving);
	assert.equal(
		run.read("src/lib/features/uses.ts"),
		lines(`import { frameSize } from "${ENCODER}";`, "export const used = frameSize;"),
	);
	assert.deepEqual(run.out, ["changed 1 files"]);
});

function asciiFile(text) {
	const root = tree({ "x.ts": text });
	const run = spawnSync(process.execPath, [stepScript("ascii.mjs"), `${root}/x.ts`], {
		encoding: "utf8",
	});
	return { status: run.status, stderr: run.stderr, text: fs.readFileSync(`${root}/x.ts`, "utf8") };
}

test("ascii.mjs keeps one space either side of an em dash and spaces a bare one", () => {
	const EM = String.fromCharCode(0x2014);
	const EN = String.fromCharCode(0x2013);
	const result = asciiFile(
		lines(
			`// a ${EM} b`,
			`// a${EM}b`,
			`// a ${EM}b`,
			`// a${EM} b`,
			`// a ${EN} b`,
			`// a${EN}b`,
			"export const ok = 1;",
		),
	);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		result.text,
		lines(
			"// a - b",
			"// a - b",
			"// a - b",
			"// a - b",
			"// a - b",
			"// a-b",
			"export const ok = 1;",
		),
	);
});

test("ascii.mjs leaves a file with no non-ASCII text unchanged", () => {
	const plain = lines("// a - b", 'export const text = "a - b";');
	const result = asciiFile(plain);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.text, plain);
});
