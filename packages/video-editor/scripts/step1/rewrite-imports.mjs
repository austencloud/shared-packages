// Usage: node rewrite-imports.mjs --task N [--dry]
//
// Rewrites tka importers of everything moved or split up to task N. Every edit is computed before
// any file is written, so a failure partway leaves tka untouched. ERROR lines name what needs a
// hand edit: a call such as vi.mock on a moved path, a default, namespace or star import of a split
// module, an import type of a split module, any use of a worker module (workers move but are never
// routed: their names surface through the entry), a default import of a moved component that the
// line rewrite below could not turn into a named import (a mixed `import X, { y } from`, a
// multi-line import, `import type X from`), and a script that imports a moved module.
//
// A file that moves whole in this task or earlier, and the source of a split in this task only, are
// left alone: the first leaves tka with its own imports as they are, move.mjs rewrites them where
// it places the file, and the second is cut into a package part and a tka part by hand. After the
// rewrite, every walked file has its imports of one package or route specifier merged and its
// all-type declarations written as `import type` (see tidyImports in lib.mjs), whether or not the
// rewrite touched it.
//
// A default import of a moved component (`import Row from "<moved>.svelte"`, a move whose `from`
// ends in .svelte) is first rewritten as a named import from the move's entry, line by line in each
// script block (see rewriteDefaultComponentImport in lib.mjs), before the specifier rewrite runs.
import fs from "node:fs";
import ts from "typescript";
import {
	NL,
	TKA,
	exportsOf,
	fileOf,
	moduleIdOf,
	parse,
	rewriteDefaultComponentImport,
	scriptBlocks,
	table,
	taskArg,
	tidyImports,
	walk,
} from "./lib.mjs";

const task = taskArg();
const dry = process.argv.includes("--dry");
const routes = new Map();
const workers = new Map();
for (const m of table.moves) {
	if (m.task > task) continue;
	if (m.from.endsWith(".worker")) workers.set(m.from, m.entry);
	else routes.set(m.from, [m.entry]);
}
for (const s of table.splits) if (s.task <= task) routes.set(s.from, s.routes);
// A file that moves whole leaves tka in its task or earlier, so it is never edited here. A split
// source is cut by hand in its own task only; from the next task on it is an ordinary tka file
// that keeps its path, so its imports are routed and tidied like any other.
const moving = new Set(
	[
		...table.moves.filter((entry) => entry.task <= task),
		...table.splits.filter((entry) => entry.task === task),
	]
		.map((entry) => fileOf(entry.from))
		.filter(Boolean),
);
// A component's `to` ends in .svelte; a .svelte.ts module's does not.
const components = table.moves.filter((m) => m.task <= task && m.to.endsWith(".svelte"));
// Maps the lines of a script body through rewriteDefaultComponentImport; each line ending (LF or
// CRLF) is kept as it is. `file` is the importing tka file, so a relative specifier resolves.
const rewriteDefaultImports = (body, file) =>
	components.length === 0
		? body
		: body
				.split(/(\r?\n)/)
				.map((part, i) =>
					i % 2 === 1
						? part
						: components.reduce(
								(line, m) => rewriteDefaultComponentImport(line, m.from, m.entry, file),
								part,
							),
				)
				.join("");
const exportCache = new Map();
const namesOf = (dest) => {
	if (!exportCache.has(dest)) exportCache.set(dest, exportsOf(dest));
	return exportCache.get(dest);
};
const errors = [];
const files = [
	...walk(`${TKA}/src`, [".ts", ".svelte"]),
	...walk(`${TKA}/tests`, [".ts", ".svelte"]),
	...walk(`${TKA}/scripts`, [".ts", ".mts", ".mjs"]),
];

function rewriteScript(file, text, offset, whole) {
	const edits = [];
	const lineOf = (node) => whole.slice(0, offset + node.getStart()).split(NL).length;
	const workerUse = (literal) => {
		const id = moduleIdOf(literal.text.replace(/[?].*$/, ""), file);
		if (!id || !workers.has(id)) return false;
		errors.push(
			`${file}:${lineOf(literal)}: uses worker module ${id}, which moves to the package (${workers.get(id)}); needs a hand edit`,
		);
		return true;
	};
	const visit = (node) => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			if (!workerUse(node.moduleSpecifier)) {
				const id = moduleIdOf(node.moduleSpecifier.text, file);
				const dests = id && routes.get(id);
				if (dests && id.endsWith(".svelte") && node.importClause?.name)
					errors.push(
						`${file}:${lineOf(node)}: default import of moved component ${id} needs a hand edit`,
					);
				else if (dests) edits.push(...planDeclaration(node, dests, file, id));
			}
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument) &&
			ts.isStringLiteral(node.argument.literal)
		) {
			const literal = node.argument.literal;
			if (!workerUse(literal)) {
				const id = moduleIdOf(literal.text, file);
				const dests = id && routes.get(id);
				if (dests && dests.length === 1)
					edits.push([literal.getStart() + 1, literal.end - 1, dests[0]]);
				else if (dests)
					errors.push(
						`${file}: import("${literal.text}") type of split module ${id} needs a hand edit`,
					);
			}
		} else if (ts.isCallExpression(node) && ts.isStringLiteral(node.arguments[0] ?? node)) {
			const arg = node.arguments[0];
			if (!workerUse(arg)) {
				const id = moduleIdOf(arg.text, file);
				const dests = id && routes.get(id);
				if (dests) {
					const callee = node.expression.getText();
					if (dests.length === 1 && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
						edits.push([arg.getStart() + 1, arg.end - 1, dests[0]]);
					} else errors.push(`${file}: ${callee}("${arg.text}") needs a hand edit`);
				}
			}
		} else if (
			ts.isNewExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "URL" &&
			node.arguments?.length > 0 &&
			ts.isStringLiteralLike(node.arguments[0])
		) {
			workerUse(node.arguments[0]);
		}
		ts.forEachChild(node, visit);
	};
	visit(parse(file, text));
	return edits;
}

function planDeclaration(node, dests, file, id) {
	const spec = node.moduleSpecifier;
	const clause = ts.isImportDeclaration(node) ? node.importClause : null;
	const named = ts.isImportDeclaration(node)
		? clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
			? clause.namedBindings
			: null
		: node.exportClause && ts.isNamedExports(node.exportClause)
			? node.exportClause
			: null;
	const hasOther = ts.isImportDeclaration(node)
		? (clause && (clause.name || (clause.namedBindings && !named))) || !clause
		: !node.exportClause;
	if (dests.length === 1) return [[spec.getStart() + 1, spec.end - 1, dests[0]]];
	if (hasOther || !named) {
		errors.push(
			`${file}: default, namespace or star import of split module ${id} needs a hand edit`,
		);
		return [];
	}
	const groups = new Map();
	for (const element of named.elements) {
		const name = (element.propertyName ?? element.name).text;
		const dest = dests.find((d) => namesOf(d).has(name));
		if (!dest) {
			errors.push(`${file}: ${name} from ${id} is exported by none of ${dests.join(", ")}`);
			return [];
		}
		if (!groups.has(dest)) groups.set(dest, []);
		groups.get(dest).push(element.getText());
	}
	// Every name routes back to the declaration's own module (a split source that keeps its path):
	// leave the declaration as written, so a formatter's layout survives the next run.
	if (groups.size === 1 && groups.has(id)) return [];
	const keyword = ts.isImportDeclaration(node) ? "import" : "export";
	const typeOnly = (ts.isImportDeclaration(node) ? clause.isTypeOnly : node.isTypeOnly)
		? " type"
		: "";
	const text = [...groups]
		.map(
			([dest, elements]) =>
				`${keyword}${typeOnly} {${NL}  ${elements.join(`,${NL}  `)},${NL}} from "${dest}";`,
		)
		.join(NL);
	return [[node.getStart(), node.end, text]];
}

const pending = [];
for (const file of files) {
	if (moving.has(file)) continue;
	const original = fs.readFileSync(file, "utf8");
	let text = original;
	let rewrote = false;
	const blocks = file.endsWith(".svelte") ? scriptBlocks(text) : [[0, text.length]];
	for (const [start, end] of blocks.reverse()) {
		const body = text.slice(start, end);
		// The default-import rewrite keeps every line break, so the line numbers of later ERROR lines
		// hold; the text before this block is still the original's.
		let next = rewriteDefaultImports(body, file);
		const edits = rewriteScript(file, next, start, text.slice(0, start) + next).sort(
			(x, y) => y[0] - x[0],
		);
		for (const [a, b, value] of edits) next = next.slice(0, a) + value + next.slice(b);
		if (next !== body) rewrote = true;
		next = tidyImports(next);
		text = text.slice(0, start) + next + text.slice(end);
	}
	if (text !== original) {
		// A merge or a type-only rewrite changes no import path, so only a rewrite calls for a look at
		// a script.
		if (rewrote && file.includes("/scripts/"))
			errors.push(`${file}: a script imports a moved module; check it still runs`);
		pending.push([file, text]);
	}
}
for (const [file, text] of pending) {
	if (dry) console.log(`would change ${file}`);
	else fs.writeFileSync(file, text);
}

console.log(`${dry ? "would change" : "changed"} ${pending.length} files`);
for (const line of errors) console.log(`ERROR ${line}`);
process.exit(errors.length === 0 ? 0 : 1);
