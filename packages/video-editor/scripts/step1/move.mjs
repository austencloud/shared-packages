// Usage:
//   node move.mjs --task N [--dry] [--force]
//   node move.mjs --check
//
// Copies each moves, splits and copies entry of task N from tka into the package, rewrites the
// copy's imports of anything already placed (task at most N) to relative .js paths, and lists every
// import it could not place as UNRESOLVED. A copies entry leaves the tka original and its importers
// alone: rewrite-imports.mjs never reads that list. A named import of a package entry (a tka file
// switched to the package in an earlier task imports "@austencloud/video-editor/core") becomes one
// import per package file that defines the names, never the entry's index.js. See placeText in
// lib.mjs.
//
//   --dry    Print the copy list, every rewritten specifier and every UNRESOLVED line, and run the
//            barrel check on what would be written. Writes nothing.
//   --force  Overwrite targets that already exist. Without it an existing target is left alone and
//            printed as SKIP, so a rerun never replaces hand edits.
//   --check  Only run the barrel check, which every move also runs at the end: exit 1 when a file
//            under src/ imports the index.js of its own folder or of a folder above it, or the
//            package by name.
import fs from "node:fs";
import path from "node:path";
import { PKG, barrelImports, fileOf, placeText, placedMap, slash, table, taskArg } from "./lib.mjs";

function check(overlay = new Map()) {
	const found = barrelImports(PKG, overlay);
	for (const line of found) console.log(`BARREL ${line}`);
	console.log(`barrel imports: ${found.length}`);
	return found.length === 0;
}

if (process.argv.includes("--check")) process.exit(check() ? 0 : 1);

const task = taskArg();
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");
const entries = [...table.moves, ...table.splits, ...table.copies];
const placed = placedMap(task);
const current = entries.filter((e) => e.task === task);
const skip = new Set(current.map((e) => `${PKG}/src/${e.to}`));

// Plan every copy before writing any, so a failure partway leaves the package untouched.
const planned = new Map();
const unresolved = [];
for (const entry of current) {
	const source = fileOf(entry.from);
	if (!source) throw new Error(`missing ${entry.from}`);
	const target = `${PKG}/src/${entry.to}`;
	if (fs.existsSync(target) && !force) {
		console.log(`SKIP src/${entry.to} (exists; --force overwrites it)`);
		continue;
	}
	const result = placeText({
		text: fs.readFileSync(source, "utf8"),
		source,
		to: entry.to,
		placed,
		skip,
	});
	planned.set(target, result.text);
	unresolved.push(...result.unresolved);
	console.log(`${dry ? "would copy" : "copied"} ${slash(source)} -> src/${entry.to}`);
	for (const line of result.rewrites) console.log(`  rewrote ${line}`);
}
if (!dry) {
	for (const [target, text] of planned) {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, text);
	}
}
for (const line of unresolved) console.log(`UNRESOLVED ${line}`);
process.exit(check(dry ? planned : new Map()) ? 0 : 1);
