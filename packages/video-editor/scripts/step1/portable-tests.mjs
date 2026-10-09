// Lists the tka test files that exercise only the package, and so can move to PKG/test.
//
// A test moves when both hold:
//   portable     every import is vitest, zod, node:*, the package, or a relative file that is itself
//                portable; and the file does not vi.mock a $lib path.
//   usesPackage  the file names @austencloud/video-editor, or a relative import it resolves does.
// Without usesPackage the rule lists hundreds of tka contract tests that read tka's repo with
// node:fs; those test tka and stay.
//
// Prints the movers, the relative helpers they need, the tests that import the package but are not
// portable (with the specifiers that stop them), and the tests that stay by name: tka guards, and
// portable tests that rely on tka's vitest setup file (the package has none).
// Run it from the package directory: node scripts/step1/portable-tests.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { TKA, parse, slash, walk } from "./lib.mjs";

const OK = (spec) =>
	spec === "vitest" ||
	spec === "zod" ||
	spec.startsWith("node:") ||
	spec.startsWith("@austencloud/video-editor");

// Tests that guard tka's own tree. They read tka's plugin folder with node:fs and stay.
const TKA_GUARDS = ["tests/unit/video-editor-bound-only.test.ts"];

// Portable by imports, but they fail in the package without tka's tests/setup/vitest-setup.ts:
// it stubs canvas getContext on created elements and polyfills Blob.prototype.arrayBuffer, and
// jsdom provides neither. They stay until the package gets a setup file of its own.
const NEEDS_TKA_SETUP = {
	"tests/unit/video-export/CanvasFrameCapturer.test.ts": "canvas getContext(2d) is null",
	"tests/unit/animation-engine/background-encoder-timeout.test.ts": "Blob.arrayBuffer is missing",
	"tests/unit/media-composition/post-audio-plan.test.ts": "Blob.arrayBuffer is missing",
	"tests/unit/media-composition/post-audio-track.test.ts": "Blob.arrayBuffer is missing",
	"tests/unit/media-composition/preview-video-frame-recovery.test.ts":
		"canvas getContext(2d) is null",
};

const analyses = new Map();

/** The module specifiers a file names, how each relative one resolves, and whether it mocks $lib. */
function analyse(file) {
	if (analyses.has(file)) return analyses.get(file);
	const text = fs.readFileSync(file, "utf8");
	const specs = [];
	ts.forEachChild(parse(file, text), function visit(node) {
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
			specs.push(node.moduleSpecifier.text);
		}
		ts.forEachChild(node, visit);
	});
	const relative = [];
	const external = [];
	for (const spec of specs) {
		if (!spec.startsWith(".")) {
			external.push(spec);
			continue;
		}
		const base = path.posix.join(path.posix.dirname(slash(file)), spec).replace(/[.](ts|js)$/, "");
		const target = [`${base}.ts`, `${base}/index.ts`].find((f) => fs.existsSync(f));
		relative.push({ spec, target });
	}
	const result = {
		text,
		relative,
		external,
		mocksLib: /vi[.]mock[(]"[$]lib/.test(text),
		namesPackage: text.includes("@austencloud/video-editor"),
	};
	analyses.set(file, result);
	return result;
}

const portableMemo = new Map();
/** True when the file and everything it imports relatively uses only the allowed modules. */
function portable(file) {
	if (portableMemo.has(file)) return portableMemo.get(file);
	portableMemo.set(file, false); // a cycle counts as failing until the walk finishes
	const info = analyse(file);
	let ok = !info.mocksLib;
	if (info.external.some((spec) => !OK(spec))) ok = false;
	for (const { target } of info.relative) {
		if (!target || !portable(target)) ok = false;
	}
	portableMemo.set(file, ok);
	return ok;
}

const usesMemo = new Map();
/** True when the file, or a relative import it resolves, names the package. */
function usesPackage(file) {
	if (usesMemo.has(file)) return usesMemo.get(file);
	usesMemo.set(file, false);
	const info = analyse(file);
	const uses =
		info.namesPackage ||
		info.relative.some(({ target }) => target !== undefined && usesPackage(target));
	usesMemo.set(file, uses);
	return uses;
}

/** The specifiers that stop a file from being portable, relative ones as written. */
function offenders(file) {
	const info = analyse(file);
	const bad = info.external.filter((spec) => !OK(spec));
	for (const { spec, target } of info.relative) {
		if (!target || !portable(target)) bad.push(spec);
	}
	if (info.mocksLib) bad.push("vi.mock($lib)");
	return bad;
}

/** Every relative file a test needs, followed through relative imports. */
function helpersOf(file, seen = new Set()) {
	for (const { target } of analyse(file).relative) {
		if (target && !seen.has(target)) {
			seen.add(target);
			helpersOf(target, seen);
		}
	}
	return seen;
}

const rel = (file) => slash(file).slice(slash(TKA).length + 1);
const itCount = (file) => (analyse(file).text.match(/^\s*(?:it|test)[(]/gm) ?? []).length;

const tests = [...walk(`${TKA}/tests`, [".test.ts"]), ...walk(`${TKA}/src`, [".test.ts"])].map(
	slash,
);
const guards = tests.filter((file) => TKA_GUARDS.includes(rel(file)));
const needSetup = tests.filter((file) => rel(file) in NEEDS_TKA_SETUP);
const movers = tests.filter(
	(file) =>
		portable(file) &&
		usesPackage(file) &&
		!TKA_GUARDS.includes(rel(file)) &&
		!(rel(file) in NEEDS_TKA_SETUP),
);

console.log(`movers: ${movers.length}`);
for (const file of movers) console.log(`${rel(file)}  its=${itCount(file)}`);

const helpers = new Set();
for (const file of movers) for (const helper of helpersOf(file)) helpers.add(helper);
console.log(`\nrelative helpers the movers need: ${helpers.size}`);
for (const file of helpers) console.log(rel(file));

const near = tests.filter((file) => !portable(file) && usesPackage(file));
console.log(`\nnot portable but imports the package: ${near.length}`);
for (const file of near) console.log(`${rel(file)}  <- ${offenders(file).join(", ")}`);

console.log(`\nstays (needs tka's vitest setup): ${needSetup.length}`);
for (const file of needSetup) console.log(`${rel(file)}  <- ${NEEDS_TKA_SETUP[rel(file)]}`);

console.log(`\nstays (tka guard): ${guards.map(rel).join(", ")}`);
