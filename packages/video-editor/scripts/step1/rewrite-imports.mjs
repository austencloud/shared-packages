// Usage: node rewrite-imports.mjs --task N [--dry]
//
// Rewrites tka importers of everything moved or split up to task N. Every edit is computed before
// any file is written, so a failure partway leaves tka untouched. ERROR lines name what needs a
// hand edit: a call such as vi.mock on a moved path, a default, namespace or star import of a split
// module, an import type of a split module, any use of a worker module (workers move but are never
// routed: their names surface through the entry), and a script that imports a moved module.
//
// A file that moves whole in this task is left alone: it leaves tka with its own imports as they
// are, and move.mjs rewrites them where it places the file. After the rewrite, every walked file
// has its imports of one package specifier merged (see mergePackageImports in lib.mjs), whether
// or not the rewrite touched it.
import fs from "node:fs";
import ts from "typescript";
import {
	NL,
	TKA,
	exportsOf,
	fileOf,
	mergePackageImports,
	moduleIdOf,
	parse,
	scriptBlocks,
	table,
	taskArg,
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
// Files that move whole leave tka in their task; nothing in them is edited here.
const moving = new Set(
	table.moves
		.filter((m) => m.task <= task)
		.map((m) => fileOf(m.from))
		.filter(Boolean),
);
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
				if (dests) edits.push(...planDeclaration(node, dests, file, id));
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
		let next = body;
		const edits = rewriteScript(file, body, start, original).sort((x, y) => y[0] - x[0]);
		for (const [a, b, value] of edits) next = next.slice(0, a) + value + next.slice(b);
		if (next !== body) rewrote = true;
		next = mergePackageImports(next);
		text = text.slice(0, start) + next + text.slice(end);
	}
	if (text !== original) {
		// A merge alone changes no import path, so only a rewrite calls for a look at a script.
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
