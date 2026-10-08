import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { PKG, TKA, fileOf, slash, table } from "./lib.mjs";

const OUT = "C:/Users/Austen/AppData/Local/Temp/claude/video-editor-step1/census";
const FLAGS = [
	"strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes", "noUnusedLocals", "noUnusedParameters",
	"noImplicitReturns", "noFallthroughCasesInSwitch", "noImplicitOverride", "noPropertyAccessFromIndexSignature",
	"useUnknownInCatchVariables", "verbatimModuleSyntax",
];
const REPORTED = ["TS6133", "TS7030", "TS7029", "TS4114", "TS1484"];
const variant = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

if (variant === "report") {
	const read = (v) => JSON.parse(fs.readFileSync(`${OUT}/${v}.json`, "utf8"));
	const base = read("base");
	console.log(`base: ${base.total} errors in ${base.files} moved files`);
	for (const code of REPORTED) console.log(`  ${code}: ${base.byCode[code] ?? 0}`);
	for (const [v, flag] of [["nuia", "noUncheckedIndexedAccess"], ["eopt", "exactOptionalPropertyTypes"]]) {
		const delta = base.total - read(v).total;
		console.log(`${flag}: delta ${delta} -> ${delta > 150 ? "TURN OFF for step 1" : "keep on, fix while moving"}`);
	}
	process.exit(0);
}

const parsed = ts.getParsedCommandLineOfConfigFile(`${PKG}/tsconfig.json`, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} });
const options = {};
for (const flag of FLAGS) if (parsed.options[flag] !== undefined) options[flag] = parsed.options[flag];
if (variant === "nuia") options.noUncheckedIndexedAccess = false;
else if (variant === "eopt") options.exactOptionalPropertyTypes = false;
else if (variant !== "base") throw new Error("variant must be base, nuia, eopt or report");

const files = [...table.moves, ...table.splits].map((e) => fileOf(e.from));
const config = `${OUT}/tsconfig.${variant}.json`;
fs.writeFileSync(config, JSON.stringify({ extends: `${TKA}/tsconfig.json`, compilerOptions: { ...options, noEmit: true, incremental: false }, files, include: [] }, null, 2));
let output = "";
try {
	output = execSync(`pnpm exec tsc -p "${config}" --pretty false`, { cwd: PKG, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
} catch (error) {
	output = String(error.stdout ?? "");
}
const wanted = new Set(files.map((f) => slash(f).toLowerCase()));
const byCode = {};
const hit = new Set();
let total = 0;
for (const line of output.split(String.fromCharCode(10))) {
	const match = /^(.+?)[(]([0-9]+),([0-9]+)[)]: error (TS[0-9]+):/.exec(line);
	if (!match) continue;
	const file = slash(path.resolve(PKG, match[1])).toLowerCase();
	if (!wanted.has(file)) continue;
	total += 1;
	hit.add(file);
	byCode[match[4]] = (byCode[match[4]] ?? 0) + 1;
}
fs.writeFileSync(`${OUT}/${variant}.json`, JSON.stringify({ variant, options, total, files: hit.size, byCode }, null, 2));
console.log(`${variant}: ${total} errors in ${hit.size} files`);
