// Usage: node forbidden-imports.mjs [--src <dir>]... [--host <dir>]...
//
// Check 1: no file under the package's src/ (or each --src folder) names a tka-only module in any
// form the TypeScript parser sees: import and export declarations including side-effect imports,
// import() calls and import types, require() and vi.mock-style calls, with either quote.
// Check 2: every "@austencloud/video-editor" specifier in tka's src/ and tests/ (or each --host
// folder) names a subpath in the package's exports map. The dev alias points at the whole dist
// folder, so a deep path works today and fails once the package is installed from npm.
// Check 1b: no Font Awesome class string (fa-...) in the package's .ts and .svelte source.
// Exit 1 when any check finds anything.
import fs from "node:fs";
import { PACKAGE, PKG, TKA, specifiersOf, walk } from "./lib.mjs";

const option = (name) =>
	process.argv.flatMap((arg, i) =>
		arg === name && process.argv[i + 1] ? [process.argv[i + 1]] : [],
	);
const srcDirs = option("--src").length > 0 ? option("--src") : [`${PKG}/src`];
const hostDirs = option("--host").length > 0 ? option("--host") : [`${TKA}/src`, `${TKA}/tests`];

const BANNED = [
	"$lib",
	"$app",
	"$env",
	"firebase",
	"bits-ui",
	"modern-screenshot",
	"@fortawesome/fontawesome-free",
];
let forbidden = 0;
for (const dir of srcDirs) {
	for (const file of walk(dir, [".ts", ".svelte"])) {
		for (const spec of specifiersOf(file)) {
			if (BANNED.some((b) => spec.text.startsWith(b))) {
				console.log(`${file}:${spec.line}: ${spec.text}`);
				forbidden += 1;
			}
		}
	}
}
console.log(`forbidden imports: ${forbidden}`);

// Check 1b: no Font Awesome class string anywhere in the package source; icons are <Icon> data.
const FA_CLASS = /(^|[\s"'`{])fa-[a-z][a-z0-9-]*/g;
let faClasses = 0;
for (const dir of srcDirs) {
	for (const file of walk(dir, [".ts", ".svelte"])) {
		const lines = fs.readFileSync(file, "utf8").split("\n");
		lines.forEach((line, index) => {
			const hits = line.match(FA_CLASS);
			if (!hits) return;
			console.log(`${file}:${index + 1}: ${hits.join(" ").trim()}`);
			faClasses += hits.length;
		});
	}
}
console.log(`fa- classes: ${faClasses}`);

const exportKeys = Object.keys(JSON.parse(fs.readFileSync(`${PKG}/package.json`, "utf8")).exports);
const exported = (subpath) =>
	exportKeys.some((key) =>
		key.endsWith("/*")
			? subpath.startsWith(key.slice(0, -1)) && subpath.length > key.length - 1
			: key === subpath,
	);
let unexported = 0;
for (const dir of hostDirs) {
	for (const file of walk(dir, [".ts", ".svelte", ".js", ".mjs", ".mts"])) {
		const text = fs.readFileSync(file, "utf8");
		if (!text.includes(PACKAGE)) continue;
		for (const spec of specifiersOf(file, text)) {
			if (spec.text !== PACKAGE && !spec.text.startsWith(`${PACKAGE}/`)) continue;
			if (exported(`.${spec.text.slice(PACKAGE.length)}`)) continue;
			console.log(`${file}:${spec.line}: ${spec.text} is not in the package exports map`);
			unexported += 1;
		}
	}
}
console.log(`unexported package subpaths: ${unexported}`);
process.exit(forbidden === 0 && faClasses === 0 && unexported === 0 ? 0 : 1);
