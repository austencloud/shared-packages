import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	ENTRIES,
	barrelImports,
	definersIn,
	placeText,
	rewriteDefaultComponentImport,
} from "../scripts/step1/lib.mjs";

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

test("placeText rewrites only the script blocks of a component and keeps .svelte", () => {
	const text = [
		'<script lang="ts">',
		'  import Child from "$lib/shared/share/components/post-studio/editor/PostToolRow.svelte";',
		'  import { clamp } from "$lib/shared/share/components/post-studio/editor/post-box-drag";',
		"</script>",
		'<p class="a">import x from "$lib/not/a/script";</p>',
	].join("\n");
	const placed = new Map([
		[
			"$lib/shared/share/components/post-studio/editor/PostToolRow.svelte",
			"ui/editor/PostToolRow.svelte",
		],
		["$lib/shared/share/components/post-studio/editor/post-box-drag", "ui/editor/post-box-drag.ts"],
	]);
	const result = placeText({ text, source: "X.svelte", to: "ui/editor/X.svelte", placed });
	assert.match(result.text, /from "[.][/]PostToolRow[.]svelte"/);
	assert.match(result.text, /from "[.][/]post-box-drag[.]js"/);
	assert.match(result.text, /<p class="a">import x from "[$]lib[/]not[/]a[/]script";<[/]p>/);
});

test("ENTRIES names the ui, strings and icons subpaths", () => {
	for (const sub of ["ui", "strings", "icons"]) {
		assert.ok(ENTRIES[`@austencloud/video-editor/${sub}`].endsWith(`/src/${sub}/index.ts`));
	}
});

test("rewriteDefaultComponentImport turns a default import of a moved component into a named one", () => {
	const line =
		'import PostToolRow from "$lib/shared/share/components/post-studio/editor/PostToolRow.svelte";';
	assert.equal(
		rewriteDefaultComponentImport(
			line,
			"$lib/shared/share/components/post-studio/editor/PostToolRow.svelte",
			"@austencloud/video-editor/ui",
		),
		'import { PostToolRow } from "@austencloud/video-editor/ui";',
	);
	const renamed = 'import Row from "$lib/x/PostToolRow.svelte";';
	assert.equal(
		rewriteDefaultComponentImport(
			renamed,
			"$lib/x/PostToolRow.svelte",
			"@austencloud/video-editor/ui",
		),
		'import { PostToolRow as Row } from "@austencloud/video-editor/ui";',
	);
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

const PLUGIN = "$lib/shared/post-studio-plugin";

// Runs rewrite-imports.mjs (task 4 unless told otherwise) over a fixture tka tree (STEP1_TKA),
// never over the real one.
function rewriteImports(files, { dry = false, task = 4 } = {}) {
	const root = tree(files);
	const args = [
		stepScript("rewrite-imports.mjs"),
		"--task",
		String(task),
		...(dry ? ["--dry"] : []),
	];
	const run = spawnSync(process.execPath, args, {
		encoding: "utf8",
		env: { ...process.env, STEP1_TKA: root, STEP_MOVES: "./moves.json" },
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

test("rewrite-imports leaves a split source untouched in its task and rewrites its staying importers", () => {
	// post-project-normalize is a split in task 7 and imports post-project-keyframes, a move in task 7.
	const split = lines(
		'import { keyframeAt } from "$lib/shared/media-composition/domain/post-project-keyframes";',
		`import { A } from "${CORE_ENTRY}";`,
		`import { B } from "${CORE_ENTRY}";`,
		"export const normalizeProject = [keyframeAt, A, B];",
	);
	const run = rewriteImports(
		{
			"src/lib/shared/media-composition/domain/post-project-normalize.ts": split,
			"src/lib/shared/media-composition/domain/post-project-keyframes.ts": lines(
				"export const keyframeAt = 1;",
			),
			"src/lib/shared/post-studio-plugin/index.ts": lines("export const normalizeProject = 1;"),
			"src/lib/features/uses.ts": lines(
				'import { normalizeProject } from "$lib/shared/media-composition/domain/post-project-normalize";',
				"export const used = normalizeProject;",
			),
		},
		{ task: 7 },
	);
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/shared/media-composition/domain/post-project-normalize.ts"),
		split,
	);
	assert.equal(
		run.read("src/lib/features/uses.ts"),
		lines(
			"import {",
			"  normalizeProject,",
			`} from "${PLUGIN}";`,
			"export const used = normalizeProject;",
		),
	);
	assert.deepEqual(run.out, ["changed 1 files"]);
});

test("rewrite-imports skips a split source only in its own task and tidies it in the next", () => {
	// pip-handoff is a split in task 8 whose source keeps its path in tka.
	const name = "src/lib/shared/media-composition/domain/pip-handoff.ts";
	const source = lines(
		`import { A } from "${CORE_ENTRY}";`,
		`import { B } from "${CORE_ENTRY}";`,
		"export const pip = [A, B];",
	);
	const own = rewriteImports({ [name]: source }, { task: 8 });
	assert.equal(own.status, 0, own.stderr);
	assert.equal(own.read(name), source);
	assert.deepEqual(own.out, ["changed 0 files"]);
	const next = rewriteImports({ [name]: source }, { task: 9 });
	assert.equal(next.status, 0, next.stderr);
	assert.equal(
		next.read(name),
		lines(`import { A, B } from "${CORE_ENTRY}";`, "export const pip = [A, B];"),
	);
	assert.deepEqual(next.out, ["changed 1 files"]);
});

test("rewrite-imports leaves an import of a kept-path split source alone when every name stays in tka", () => {
	// pip-handoff is a task 8 split that keeps its path. pipHandoffOf stays in tka and
	// pipHandoffSample is core, so only an import naming the second needs a new route.
	const PIP = "$lib/shared/media-composition/domain/pip-handoff";
	const source = {
		"src/lib/shared/media-composition/domain/pip-handoff.ts": lines(
			"export const pipHandoffOf = 1;",
		),
	};
	const tkaHalf = lines(
		`import { pipHandoffOf } from "${PIP}";`,
		"export const used = pipHandoffOf;",
	);
	for (const task of [8, 9]) {
		const kept = rewriteImports({ ...source, "src/lib/features/uses.ts": tkaHalf }, { task });
		assert.equal(kept.status, 0, kept.stderr);
		assert.equal(kept.read("src/lib/features/uses.ts"), tkaHalf);
		assert.deepEqual(kept.out, ["changed 0 files"]);
		const both = rewriteImports(
			{
				...source,
				"src/lib/features/uses.ts": lines(
					`import { pipHandoffOf, pipHandoffSample } from "${PIP}";`,
					"export const used = [pipHandoffOf, pipHandoffSample];",
				),
			},
			{ task },
		);
		assert.equal(both.status, 0, both.stderr);
		assert.equal(
			both.read("src/lib/features/uses.ts"),
			lines(
				"import {",
				"  pipHandoffOf,",
				`} from "${PIP}";`,
				"import {",
				"  pipHandoffSample,",
				`} from "${CORE_ENTRY}";`,
				"export const used = [pipHandoffOf, pipHandoffSample];",
			),
		);
		assert.deepEqual(both.out, ["changed 1 files"]);
	}
});

test("rewrite-imports merges two value imports from a route specifier", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { A } from "${PLUGIN}";`,
			'import { z } from "zod";',
			`import { B, type C } from "${PLUGIN}";`,
			"export const used = [A, B, z];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { A, B, type C } from "${PLUGIN}";`,
			'import { z } from "zod";',
			"export const used = [A, B, z];",
		),
	);
});

test("rewrite-imports turns an all-type inline import into import type and keeps aliases", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { type A, type B as Bee } from "${PLUGIN}";`,
			"import {",
			"\ttype D,",
			"\ttype E,",
			`} from "${PLUGIN}2";`,
			`import { type X } from "${ENCODER}";`,
			"export type Used = [A, Bee, D, E, X];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	// Only the plugin route and the package entry are eligible; the route plus a 2 is another module.
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import type { A, B as Bee } from "${PLUGIN}";`,
			"import {",
			"\ttype D,",
			"\ttype E,",
			`} from "${PLUGIN}2";`,
			`import type { X } from "${ENCODER}";`,
			"export type Used = [A, Bee, D, E, X];",
		),
	);
});

test("rewrite-imports keeps the layout of a multi-line all-type import", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			"import {",
			"\ttype A, // first",
			"\ttype B,",
			`} from "${PLUGIN}";`,
			"export type Used = [A, B];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			"import type {",
			"\tA, // first",
			"\tB,",
			`} from "${PLUGIN}";`,
			"export type Used = [A, B];",
		),
	);
});

test("rewrite-imports merges all-type declarations into one import type", () => {
	const run = rewriteImports({
		"src/lib/a.ts": lines(
			`import { type A } from "${PLUGIN}";`,
			`import { type B, type C } from "${PLUGIN}";`,
			`import type { D } from "${PLUGIN}";`,
			"export type Used = [A, B, C, D];",
		),
	});
	assert.equal(run.status, 0, run.stderr);
	// The inline-type declarations merge first, become import type, and then join the existing one.
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(`import type { A, B, C, D } from "${PLUGIN}";`, "export type Used = [A, B, C, D];"),
	);
	const again = spawnSync(
		process.execPath,
		[stepScript("rewrite-imports.mjs"), "--task", "4", "--dry"],
		{
			encoding: "utf8",
			env: { ...process.env, STEP1_TKA: run.root, STEP_MOVES: "./moves.json" },
		},
	);
	assert.equal(again.stdout.trim(), "would change 0 files");
});

test("rewrite-imports leaves a mixed declaration as a value import", () => {
	const mixed = lines(
		`import { type A, B } from "${PLUGIN}";`,
		`import { C, type D as Dee } from "${PLUGIN}";`,
		"export const used = [B, C];",
		"export type Used = [A, Dee];",
	);
	const run = rewriteImports({ "src/lib/a.ts": mixed });
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/a.ts"),
		lines(
			`import { type A, B, C, type D as Dee } from "${PLUGIN}";`,
			"export const used = [B, C];",
			"export type Used = [A, Dee];",
		),
	);
});

test("rewrite-imports does not touch a specifier that is not a route", () => {
	const text = lines(
		'import { a } from "$lib/other";',
		'import { b } from "$lib/other";',
		'import { type T } from "$lib/other";',
		'import { type U } from "zod";',
		"export const used = [a, b];",
	);
	const run = rewriteImports({ "src/lib/a.ts": text }, { dry: true });
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(run.out, ["would change 0 files"]);
	assert.equal(run.read("src/lib/a.ts"), text);
});

test("rewrite-imports leaves default, namespace, side-effect and empty imports of a route alone", () => {
	const text = lines(
		`import Def, { type X } from "${PLUGIN}";`,
		`import * as ns from "${PLUGIN}";`,
		`import "${PLUGIN}";`,
		`import {} from "${PLUGIN}";`,
		`import type { T } from "${PLUGIN}";`,
		"export type Used = [X, T];",
	);
	const run = rewriteImports({ "src/lib/a.ts": text }, { dry: true });
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(run.out, ["would change 0 files"]);
});

test("rewrite-imports normalizes inside each svelte script block only", () => {
	const run = rewriteImports({
		"src/lib/Panel.svelte": lines(
			'<script context="module" lang="ts">',
			`\timport { type A } from "${PLUGIN}";`,
			`\timport { type B } from "${PLUGIN}";`,
			"</script>",
			"",
			'<script lang="ts">',
			`\timport { type C, D } from "${PLUGIN}";`,
			`\timport { type E } from "${PLUGIN}";`,
			"</script>",
			"",
			`<p>import { type F } from "${PLUGIN}";</p>`,
		),
	});
	assert.equal(run.status, 0, run.stderr);
	assert.equal(
		run.read("src/lib/Panel.svelte"),
		lines(
			'<script context="module" lang="ts">',
			`\timport type { A, B } from "${PLUGIN}";`,
			"</script>",
			"",
			'<script lang="ts">',
			`\timport { type C, D, type E } from "${PLUGIN}";`,
			"</script>",
			"",
			`<p>import { type F } from "${PLUGIN}";</p>`,
		),
	);
});

test("a normalization alone in a script is listed as a change and raises no ERROR", () => {
	const run = rewriteImports(
		{
			"scripts/tool.ts": lines(
				`import { type A } from "${PLUGIN}";`,
				`import { type B } from "${PLUGIN}";`,
				"export type Used = [A, B];",
			),
		},
		{ dry: true },
	);
	assert.equal(run.status, 0, run.stderr);
	assert.deepEqual(run.out, [`would change ${run.root}/scripts/tool.ts`, "would change 1 files"]);
});

function asciiFile(text, name = "x.ts") {
	const root = tree({ [name]: text });
	const run = spawnSync(process.execPath, [stepScript("ascii.mjs"), `${root}/${name}`], {
		encoding: "utf8",
	});
	return {
		status: run.status,
		stderr: run.stderr,
		text: fs.readFileSync(`${root}/${name}`, "utf8"),
	};
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

test("ascii.mjs rewrites the script blocks of a component and leaves its markup and styles", () => {
	const EM = String.fromCharCode(0x2014);
	const TIMES = String.fromCharCode(0xd7);
	const BACKSLASH = String.fromCharCode(92);
	const component = (script, markup, style) =>
		lines(
			'<script lang="ts">',
			...script,
			"</script>",
			`<p>${markup}</p>`,
			"<style>",
			`\t.a::after { content: "${style}"; }`,
			"</style>",
		);
	const result = asciiFile(
		component([`\t// a ${EM} b`, `\tconst label = "2${TIMES}";`], `2${TIMES} ${EM} zoom`, TIMES),
		"x.svelte",
	);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		result.text,
		component(
			["\t// a - b", `\tconst label = "2${BACKSLASH}u00d7";`],
			`2${TIMES} ${EM} zoom`,
			TIMES,
		),
	);
});

// Runs portable-tests.mjs over a fixture tka tree (STEP1_TKA), never over the real one.
function portableTests(files) {
	const root = tree(files);
	const run = spawnSync(process.execPath, [stepScript("portable-tests.mjs")], {
		encoding: "utf8",
		env: { ...process.env, STEP1_TKA: root, STEP_MOVES: "./moves.json" },
	});
	return { status: run.status, stderr: run.stderr, out: run.stdout.split(NL) };
}

test("portable-tests lists both tests that reach the package through a helper cycle, in either order", () => {
	// h1 imports h2 before p, so a walk that starts at h1 meets h2 while h1 is still open.
	const helpers = {
		"tests/unit/p.ts": lines(
			'import { core } from "@austencloud/video-editor/core";',
			"export const p = core;",
		),
		"tests/unit/h1.ts": lines(
			'import { h2 } from "./h2";',
			'import { p } from "./p";',
			"export const h1 = [h2, p];",
		),
		"tests/unit/h2.ts": lines('import { h1 } from "./h1";', "export const h2 = h1;"),
	};
	const testUsing = (helper) =>
		lines(
			'import { it } from "vitest";',
			`import { ${helper} } from "./${helper}";`,
			`it("uses ${helper}", () => void ${helper});`,
		);
	// The second pass swaps which test file imports which helper, so each helper is met first once.
	for (const [first, second] of [
		["h1", "h2"],
		["h2", "h1"],
	]) {
		const run = portableTests({
			...helpers,
			"tests/unit/a.test.ts": testUsing(first),
			"tests/unit/b.test.ts": testUsing(second),
		});
		assert.equal(run.status, 0, run.stderr);
		for (const name of ["tests/unit/a.test.ts", "tests/unit/b.test.ts"]) {
			assert.ok(
				run.out.some((row) => row.startsWith(`${name}  `)),
				`${name} is listed when a imports ${first} and b imports ${second}:${NL}${run.out.join(NL)}`,
			);
		}
	}
});

// The type gate: a worktree prints node_modules files through the junction as
// ../../../tka-platform/node_modules/..., and TypeScript may print a union, or the properties of an
// object type in it, in either order.
test("check-intersection ignores the junction prefix, union order and property order", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intersection-"));
	roots.push(dir);
	const baseline = path.join(dir, "baseline.txt");
	const after = path.join(dir, "after.txt");
	fs.writeFileSync(
		baseline,
		[
			"node_modules/@types/three/index.d.ts:10:2",
			`Error: Type '"b" | "a" | Foo<"x" | "y">' is not assignable to type 'C'. (ts2322)`,
			"src/lib/a.ts:1:1",
			`Error: Argument of type '() => void | number' is not assignable. (ts2345)`,
			"src/lib/b.svelte:5:1",
			`Error: Type '{ "0": { e: E; }; "*"?: undefined; } | { "0"?: undefined; "*": { e: "a" | "b"; }; }' is not assignable to type 'T'. (ts2322)`,
			"Found 3 errors",
		].join(NL),
	);
	fs.writeFileSync(
		after,
		[
			"../../../tka-platform/node_modules/@types/three/index.d.ts:12:4",
			`Error: Type 'Foo<"x" | "y"> | "a" | "b"' is not assignable to type 'C'. (ts2322)`,
			"src/lib/a.ts:3:1",
			`Error: Argument of type '() => void | number' is not assignable. (ts2345)`,
			"src/lib/b.svelte:9:1",
			`Error: Type '{ "*": { e: "a" | "b"; }; "0"?: undefined; } | { "*"?: undefined; "0": { e: E; }; }' is not assignable to type 'T'. (ts2322)`,
			"Found 3 errors",
		].join(NL),
	);
	const out = execFileSync(
		process.execPath,
		[stepScript("check-intersection.mjs"), baseline, after],
		{
			encoding: "utf8",
		},
	);
	assert.match(out, /baseline 3, after 3, new 0/);
});

test("check-intersection still prints NEW for a different union or property set", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intersection-new-"));
	roots.push(dir);
	const baseline = path.join(dir, "baseline.txt");
	const after = path.join(dir, "after.txt");
	fs.writeFileSync(
		baseline,
		[
			"src/lib/a.ts:1:1",
			`Error: Type '"a" | "b"' is not assignable to type 'C'. (ts2322)`,
			"src/lib/b.svelte:5:1",
			`Error: Type '{ x: 1; y: 2; }' is not assignable to type 'T'. (ts2322)`,
			"Found 2 errors",
		].join(NL),
	);
	fs.writeFileSync(
		after,
		[
			"src/lib/a.ts:1:1",
			`Error: Type '"a" | "c"' is not assignable to type 'C'. (ts2322)`,
			"src/lib/b.svelte:5:1",
			`Error: Type '{ x: 1; z: 2; }' is not assignable to type 'T'. (ts2322)`,
			"Found 2 errors",
		].join(NL),
	);
	const run = spawnSync(process.execPath, [stepScript("check-intersection.mjs"), baseline, after], {
		encoding: "utf8",
	});
	// Exit 1 and one NEW line for each key that changed: the union with a different member, and
	// the object type with a different property.
	assert.equal(run.status, 1, run.stderr);
	assert.match(run.stdout, /baseline 2, after 2, new 2/);
	const added = run.stdout.split(NL).filter((row) => row.startsWith("NEW: "));
	assert.equal(added.length, 2, run.stdout);
	assert.ok(
		added.some((row) => row.includes(`'"a" | "c"'`)),
		run.stdout,
	);
	assert.ok(
		added.some((row) => row.includes("'{ x: 1; z: 2; }'")),
		run.stdout,
	);
});

test("STEP_MOVES selects the move list", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moves-"));
	roots.push(dir);
	const list = path.join(dir, "moves.json");
	fs.writeFileSync(
		list,
		JSON.stringify({
			moves: [
				{ task: 1, from: "$lib/x", to: "core/x.ts", entry: "@austencloud/video-editor/core" },
			],
			splits: [],
		}),
	);
	const lib = pathToFileURL(stepScript("lib.mjs")).href;
	const out = execFileSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`const m = await import(${JSON.stringify(lib)}); console.log(m.table.moves.length, m.MOVES === process.env.STEP_MOVES);`,
		],
		{ encoding: "utf8", env: { ...process.env, STEP_MOVES: list } },
	);
	assert.equal(out.trim(), "1 true");
});
