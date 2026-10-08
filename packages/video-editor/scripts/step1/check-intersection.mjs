// Usage: node check-intersection.mjs <baseline> <after>
//
// Compares two logs of tka's `npm run check:fast`. svelte-fast-check prints each diagnostic as a
// colored "path:line:col" line followed by an "Error: message (tsNNNN)" line; the two are joined
// into one key of path, message and TS code, with line and column numbers stripped and pnpm store
// folders reduced to name@version, and each key is counted.
//
// Exit 1 when a key appears more often after than before (each NEW line shows both counts).
// Exit 2 when the after log cannot be trusted: a log lacks the "Found N error(s)" summary, a
// summary disagrees with the errors counted, or more files failed to convert than before.
import fs from "node:fs";

const NL = String.fromCharCode(10);
const ESC = String.fromCharCode(27);
const BACKSLASH = String.fromCharCode(92);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const PNPM_STORE = /node_modules[/][.]pnpm[/]((?:@[^/+]+[+])?[^/@]+)@([^/_]+)(?:_[^/]*)?/g;

const keyOf = (location, message) =>
	`${location.split(BACKSLASH).join("/").replace(PNPM_STORE, "$1@$2")} ${message}`
		.replace(/:[0-9]+:[0-9]+/g, "")
		.replace(/[(][0-9]+,[0-9]+[)]/g, "")
		.replace(/[ ]+/g, " ")
		.trim();

function read(file) {
	const keys = new Map();
	let summary = null;
	let failed = 0;
	let location = null;
	for (const raw of fs.readFileSync(file, "utf8").split(NL)) {
		const line = raw.replace(ANSI, "").trim();
		const found = /^(.+?):[0-9]+:[0-9]+$/.exec(line);
		if (found) {
			location = found[1];
			continue;
		}
		const total = /^Found ([0-9]+) errors?\b/.exec(line);
		if (total) {
			summary = Number(total[1]);
			continue;
		}
		const unconverted = /^Failed to convert ([0-9]+) files?/.exec(line);
		if (unconverted) {
			failed = Number(unconverted[1]);
			continue;
		}
		if (location && /^Error\b/.test(line)) {
			const key = keyOf(location, line);
			keys.set(key, (keys.get(key) ?? 0) + 1);
			location = null;
		} else if (/^Warning\b/.test(line)) location = null;
	}
	const counted = [...keys.values()].reduce((a, b) => a + b, 0);
	return { keys, summary, failed, counted };
}

const [baselineFile, afterFile] = process.argv.slice(2);
const before = read(baselineFile);
const after = read(afterFile);
const added = [...after.keys].filter(([key, n]) => n > (before.keys.get(key) ?? 0));
console.log(`baseline ${before.counted}, after ${after.counted}, new ${added.length}`);
for (const [key, n] of added)
	console.log(`NEW: ${key} (before ${before.keys.get(key) ?? 0}, after ${n})`);

const untrusted = [];
for (const [name, log] of [
	["baseline", before],
	["after", after],
]) {
	if (log.summary === null) untrusted.push(`${name} has no "Found N error(s)" summary line`);
	else if (log.summary !== log.counted) {
		untrusted.push(`${name} summary says ${log.summary} errors but ${log.counted} were counted`);
	}
}
if (after.failed > before.failed) {
	untrusted.push(`failed to convert: baseline ${before.failed} files, after ${after.failed} files`);
}
for (const line of untrusted) console.log(`FAIL: ${line}`);
process.exit(untrusted.length > 0 ? 2 : added.length > 0 ? 1 : 0);
