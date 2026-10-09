// Lists the tka test files that exercise only the package, and so can move to PKG/test.
//
// A test moves when both hold:
//   portable     every import is vitest, zod, node:*, the package, or a relative file that is itself
//                portable; and the file does not vi.mock a $lib or ".." path or import $lib
//                dynamically.
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

// Tests that are portable by imports but need tka's setup file. The package has its own setup
// since step 2A (test/setup/), so none are kept back; an entry here names a new one.
const NEEDS_TKA_SETUP = {};

const analyses = new Map();

/**
 * The module specifiers a file names (static ones only), how each relative one resolves, and
 * whether it mocks a $lib or relative path or imports $lib dynamically: those reach tka's tree
 * without a static specifier, so the file is not portable.
 */
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
		mocksRelative: /vi[.]mock[(]"[.][.]/.test(text),
		dynamicLib: /\bimport[(]"[$]lib/.test(text),
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
	let ok = !info.mocksLib && !info.mocksRelative && !info.dynamicLib;
	if (info.external.some((spec) => !OK(spec))) ok = false;
	for (const { target } of info.relative) {
		if (!target || !portable(target)) ok = false;
	}
	portableMemo.set(file, ok);
	return ok;
}

/**
 * True when the file, or any file it imports relatively at any depth, names the package. It reads
 * the walk helpersOf already does, so the answer does not depend on visit order.
 */
const usesPackage = (file) =>
	analyse(file).namesPackage || [...helpersOf(file)].some((f) => analyse(f).namesPackage);

/** The specifiers that stop a file from being portable, relative ones as written. */
function offenders(file) {
	const info = analyse(file);
	const bad = info.external.filter((spec) => !OK(spec));
	for (const { spec, target } of info.relative) {
		if (!target || !portable(target)) bad.push(spec);
	}
	if (info.mocksLib) bad.push("vi.mock($lib)");
	if (info.mocksRelative) bad.push("vi.mock(relative path)");
	if (info.dynamicLib) bad.push('import("$lib")');
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
// it, test and their modifiers (skip, only, todo, each, ...) at the start of a line. A table test
// runs once per row, so a file with .each( carries a note: the count is not the vitest total.
const itCount = (file) => {
	const { text } = analyse(file);
	const count = (text.match(/^\s*(?:it|test)(?:[.]\w+)*[(]/gm) ?? []).length;
	return text.includes(".each(") ? `${count} (has each: hand count)` : String(count);
};

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
