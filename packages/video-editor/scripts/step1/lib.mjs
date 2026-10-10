import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const NL = String.fromCharCode(10);
// STEP1_TKA points the tools at a fixture tree; the node tests set it so they never touch tka.
export const TKA = process.env.STEP1_TKA ?? "E:/worktrees/tka-platform/video-editor";
export const PKG = "E:/worktrees/shared-packages/video-editor/packages/video-editor";
export const PACKAGE = "@austencloud/video-editor";
export const ENTRIES = {
	"@austencloud/video-editor": `${PKG}/src/index.ts`,
	"@austencloud/video-editor/core": `${PKG}/src/core/index.ts`,
	"@austencloud/video-editor/render": `${PKG}/src/render/index.ts`,
	"@austencloud/video-editor/encoder": `${PKG}/src/encoder/index.ts`,
	"@austencloud/video-editor/ui": `${PKG}/src/ui/index.ts`,
	"@austencloud/video-editor/strings": `${PKG}/src/strings/index.ts`,
	"@austencloud/video-editor/icons": `${PKG}/src/icons/index.ts`,
};
// STEP_MOVES picks the move list: a path relative to this folder (./moves.json is step 1,
// ../step2/moves.json is step 2A) or an absolute path (the node tests use one).
export const MOVES = process.env.STEP_MOVES ?? "./moves.json";
export const table = JSON.parse(
	fs.readFileSync(path.isAbsolute(MOVES) ? MOVES : new URL(MOVES, import.meta.url), "utf8"),
);
export const slash = (p) => p.split(path.sep).join("/");

export function taskArg() {
	const i = process.argv.indexOf("--task");
	const n = i < 0 ? NaN : Number(process.argv[i + 1]);
	if (!Number.isInteger(n)) throw new Error("pass --task <number>");
	return n;
}

/** A tka module id ("$lib/...", no extension) for a specifier, or null for packages and paths outside src/lib. */
export function moduleIdOf(spec, fromFile) {
	const strip = (s) => s.replace(/[.](ts|js)$/, "");
	if (spec.startsWith("$lib/")) return strip(spec);
	if (!spec.startsWith(".")) return null;
	const abs = strip(path.posix.join(path.posix.dirname(slash(fromFile)), spec));
	const lib = `${TKA}/src/lib/`;
	return abs.startsWith(lib) ? `$lib/${abs.slice(lib.length)}` : null;
}

/** The source file for a module id or package specifier. */
export function fileOf(spec) {
	if (ENTRIES[spec]) return ENTRIES[spec];
	const base = spec.startsWith("$lib/") ? `${TKA}/src/lib/${spec.slice(5)}` : spec;
	for (const candidate of [base, `${base}.ts`, `${base}.svelte.ts`, `${base}/index.ts`]) {
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return null;
}

export function parse(file, text = fs.readFileSync(file, "utf8")) {
	return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const lineAt = (text, pos) => text.slice(0, pos).split(NL).length;

/** The [start, end) offsets of the script bodies in a .svelte file. */
export function scriptBlocks(text) {
	const blocks = [];
	let from = 0;
	for (;;) {
		const open = text.indexOf("<script", from);
		if (open < 0) break;
		const bodyStart = text.indexOf(">", open) + 1;
		const close = text.indexOf("</script>", bodyStart);
		// A markup string such as {@html `<script ...><\/script>`} has no literal closing tag; stop instead of looping.
		if (close < 0) break;
		blocks.push([bodyStart, close]);
		from = close + 9;
	}
	return blocks;
}

const isBlank = (char) => char === " " || char === "\t";

const isPackageSpecifier = (spec) => spec === PACKAGE || spec.startsWith(`${PACKAGE}/`);

/**
 * The route strings of the splits that are not package specifiers: the tka modules a split leaves
 * behind as its host half: the plugin folder, and the modules that keep their own path. Every
 * split counts, whatever its task.
 */
export const ROUTE_SPECIFIERS = new Set(
	table.splits.flatMap((split) => split.routes).filter((route) => !isPackageSpecifier(route)),
);

/** The specifiers whose imports are merged and normalized: the package and its entries, and the split routes. */
export const isTidySpecifier = (spec) => isPackageSpecifier(spec) || ROUTE_SPECIFIERS.has(spec);

/**
 * Merge the top-level named imports of one script block that share a tidy specifier (the package
 * itself, one of its entries or a split route; see isTidySpecifier) and a kind. Kind is
 * `import { ... }` against `import type { ... }`, and the two are never merged: under
 * verbatimModuleSyntax an inline `type` still keeps a runtime import, an `import type` does not.
 * A default, namespace or side-effect import is left where it is. The merged declaration takes the
 * first declaration's place as one line, with the bindings of the group in order of first
 * appearance, an identical binding listed once and each inline `type` and `as` kept; the other
 * declarations of the group go with the line break after them. Returns the text of the block,
 * unchanged when nothing merges.
 */
export function mergePackageImports(text) {
	const groups = new Map();
	for (const node of parse("block.ts", text).statements) {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
		const spec = node.moduleSpecifier.text;
		if (!isTidySpecifier(spec)) continue;
		const clause = node.importClause;
		const named =
			clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
				? clause.namedBindings
				: null;
		if (!named || named.elements.length === 0 || (node.attributes ?? node.assertClause)) continue;
		const key = `${clause.isTypeOnly ? "type" : "value"} ${spec}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(node);
	}
	const edits = [];
	for (const [first, ...rest] of groups.values()) {
		if (rest.length === 0) continue;
		const seen = new Set();
		const bindings = [];
		for (const node of [first, ...rest]) {
			for (const element of node.importClause.namedBindings.elements) {
				const imported = element.propertyName ? element.propertyName.getText() : "";
				const local = element.name.getText();
				const key = `${element.isTypeOnly}|${imported}|${local}`;
				if (seen.has(key)) continue;
				seen.add(key);
				bindings.push(
					`${element.isTypeOnly ? "type " : ""}${imported ? `${imported} as ${local}` : local}`,
				);
			}
		}
		const keyword = first.importClause.isTypeOnly ? "import type" : "import";
		edits.push([
			first.getStart(),
			first.end,
			`${keyword} { ${bindings.join(", ")} } from "${first.moduleSpecifier.text}";`,
		]);
		for (const node of rest) {
			// A declaration alone on its line goes with its indentation and line break; one sharing
			// its line (or followed by a comment) goes alone.
			let from = node.getStart();
			let to = node.end;
			let before = from;
			while (before > 0 && isBlank(text[before - 1])) before--;
			let after = to;
			while (after < text.length && isBlank(text[after])) after++;
			const lineBreak = text.startsWith("\r\n", after) ? 2 : text[after] === "\n" ? 1 : 0;
			const startsLine = before === 0 || text[before - 1] === "\n";
			if (startsLine && (lineBreak > 0 || after === text.length)) {
				from = before;
				to = after + lineBreak;
			}
			edits.push([from, to, ""]);
		}
	}
	let out = text;
	for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) {
		out = out.slice(0, start) + value + out.slice(end);
	}
	return out;
}

/**
 * Rewrite each top-level `import { type A, type B as C } from "spec"` of a tidy specifier as
 * `import type { A, B as C } from "spec"`. Under verbatimModuleSyntax the inline form keeps a
 * runtime `import {} from "spec"` edge and the type-only form keeps none. A declaration with any
 * value binding, a default or namespace binding, an import attribute or no binding at all is left
 * as it is. Only the keywords change, so layout and comments stay. Returns the text of the block,
 * unchanged when nothing qualifies.
 */
export function typeOnlyImports(text) {
	const edits = [];
	for (const node of parse("block.ts", text).statements) {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
		if (!isTidySpecifier(node.moduleSpecifier.text)) continue;
		const clause = node.importClause;
		const named =
			clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
				? clause.namedBindings
				: null;
		if (!named || clause.isTypeOnly || (node.attributes ?? node.assertClause)) continue;
		if (named.elements.length === 0 || !named.elements.every((element) => element.isTypeOnly))
			continue;
		const at = named.getStart();
		edits.push([at, at, /\s/.test(text[at - 1]) ? "type " : " type "]);
		for (const element of named.elements) {
			edits.push([element.getStart(), (element.propertyName ?? element.name).getStart(), ""]);
		}
	}
	let out = text;
	for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) {
		out = out.slice(0, start) + value + out.slice(end);
	}
	return out;
}

/**
 * The import tidying every walked tka file gets: merge the declarations of one tidy specifier,
 * then write the ones left with only inline `type` members as `import type`, then merge again so
 * those join an `import type` the file already had. Merging first lets two all-type value
 * declarations become one `import type` line; the second merge makes a rerun change nothing.
 */
export function tidyImports(text) {
	return mergePackageImports(typeOnlyImports(mergePackageImports(text)));
}

/**
 * What one file exports through its top-level statements: the names it declares itself (`local`,
 * which includes `export { a }` of a local binding and `export * as ns from`), the names it
 * re-exports from another module (`reexports`, name to specifier) and the modules it re-exports
 * whole (`stars`, specifiers).
 */
export function exportTableOf(file, text = fs.readFileSync(file, "utf8")) {
	const local = new Set();
	const reexports = new Map();
	const stars = [];
	for (const statement of parse(file, text).statements) {
		if (ts.isExportDeclaration(statement)) {
			const from =
				statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
					? statement.moduleSpecifier.text
					: null;
			if (!statement.exportClause) {
				if (from) stars.push(from);
			} else if (ts.isNamedExports(statement.exportClause)) {
				for (const element of statement.exportClause.elements) {
					if (from) reexports.set(element.name.text, from);
					else local.add(element.name.text);
				}
			} else {
				local.add(statement.exportClause.name.text);
			}
			continue;
		}
		const exported =
			ts.canHaveModifiers(statement) &&
			(ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
		if (!exported) continue;
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) local.add(declaration.name.text);
			}
		} else if (statement.name && ts.isIdentifier(statement.name)) {
			local.add(statement.name.text);
		}
	}
	return { local, reexports, stars };
}

/** Every name a module exports, following export-star and export-from through relative, $lib and package paths. */
export function exportsOf(spec, seen = new Set()) {
	const file = fileOf(spec);
	if (!file) {
		if (spec.startsWith(".") || spec.startsWith("$lib/")) throw new Error(`cannot resolve ${spec}`);
		return new Set(); // export * from an npm package: its names are never routed
	}
	if (seen.has(file)) return new Set();
	seen.add(file);
	const { local, reexports, stars } = exportTableOf(file);
	const names = new Set([...local, ...reexports.keys()]);
	for (const from of stars) {
		const target = from.startsWith(".")
			? path.posix.join(path.posix.dirname(slash(file)), from).replace(/[.]js$/, "")
			: from;
		for (const name of exportsOf(target, seen)) names.add(name);
	}
	return names;
}

/**
 * The files under `dir` that export each name, for pointing an import of a package entry at the
 * file behind it instead of at the entry's barrel. Returns a lookup from a name to its files: the
 * files that declare it, or when none does, the files that re-export it by name. Declaration
 * files and the files in `skip` are left out.
 */
export function definersIn(dir, skip = new Set()) {
	const declared = new Map();
	const reexported = new Map();
	const add = (map, name, file) => {
		if (!map.has(name)) map.set(name, []);
		map.get(name).push(file);
	};
	for (const file of walk(dir, [".ts"])) {
		if (file.endsWith(".d.ts") || skip.has(file)) continue;
		const { local, reexports } = exportTableOf(file);
		for (const name of local) add(declared, name, file);
		for (const name of reexports.keys()) add(reexported, name, file);
	}
	return (name) => declared.get(name) ?? reexported.get(name) ?? [];
}

const MODULE_CALLS = new Set([
	"mock",
	"doMock",
	"unmock",
	"doUnmock",
	"importActual",
	"importMock",
	"requireActual",
	"requireMock",
]);

/**
 * Every module specifier a file names, with its line: import and export declarations (side-effect
 * imports too), import() calls and import types, require() and vi.mock-style calls. A .svelte file
 * is read through its script blocks. Comments and other strings are never matched.
 */
export function specifiersOf(file, text = fs.readFileSync(file, "utf8")) {
	const found = [];
	const blocks = file.endsWith(".svelte") ? scriptBlocks(text) : [[0, text.length]];
	for (const [start, end] of blocks) {
		const visit = (node) => {
			let literal = null;
			if (
				(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				literal = node.moduleSpecifier;
			} else if (
				ts.isImportTypeNode(node) &&
				ts.isLiteralTypeNode(node.argument) &&
				ts.isStringLiteral(node.argument.literal)
			) {
				literal = node.argument.literal;
			} else if (
				ts.isCallExpression(node) &&
				node.arguments.length > 0 &&
				ts.isStringLiteralLike(node.arguments[0])
			) {
				const callee = node.expression;
				const moduleCall =
					callee.kind === ts.SyntaxKind.ImportKeyword ||
					(ts.isIdentifier(callee) && callee.text === "require") ||
					(ts.isPropertyAccessExpression(callee) && MODULE_CALLS.has(callee.name.text));
				if (moduleCall) literal = node.arguments[0];
			}
			if (literal)
				found.push({ text: literal.text, line: lineAt(text, start + literal.getStart()) });
			ts.forEachChild(node, visit);
		};
		visit(parse(file, text.slice(start, end)));
	}
	return found;
}

/**
 * Rewrite the text of a tka file being placed at `src/<to>` in the package rooted at `root`.
 *
 * - An import of a module already placed (`placed`: tka module id to path under src/) becomes a
 *   relative `.js` path to it.
 * - A named import or export of a package entry (`entries`: specifier to its index.ts) becomes one
 *   declaration per package file that exports the names, keeping `import type`, `export ... from`,
 *   inline `type` and `as`. Never the entry's barrel: from inside the package that is an import
 *   cycle. The lookup leaves out the entry's own index.ts and the files in `skip` (the targets of
 *   the current move). A name no file or several files export, and any other form (default,
 *   namespace, side-effect, import() call), leaves the declaration as is with an UNRESOLVED line.
 * - Any other import of a tka module, and any import type of a tka module or an entry, is listed as
 *   UNRESOLVED and left as is.
 *
 * Returns the new text, the rewritten specifiers and the UNRESOLVED lines.
 */
export function placeScript({
	text,
	source,
	to,
	root = PKG,
	placed = new Map(),
	entries = ENTRIES,
	skip = new Set(),
}) {
	const here = `src/${to}`;
	const relTo = (target) => {
		const rel = path.posix.relative(path.posix.dirname(here), target).replace(/[.]ts$/, ".js");
		return rel.startsWith(".") ? rel : `./${rel}`;
	};
	const lookups = new Map();
	const lookupFor = (spec) => {
		if (!lookups.has(spec)) {
			const barrel = entries[spec];
			lookups.set(spec, definersIn(path.posix.dirname(barrel), new Set([...skip, barrel])));
		}
		return lookups.get(spec);
	};
	const edits = [];
	const rewrites = [];
	const unresolved = [];

	const splitEntry = (node) => {
		const spec = node.moduleSpecifier.text;
		const isImport = ts.isImportDeclaration(node);
		const clause = isImport ? node.importClause : null;
		const named = isImport
			? clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
				? clause.namedBindings
				: null
			: node.exportClause && ts.isNamedExports(node.exportClause)
				? node.exportClause
				: null;
		if (!named || named.elements.length === 0) {
			const shown = node.getText().replace(/\s+/g, " ");
			unresolved.push(`${to}: ${shown} (only named imports and exports of an entry are split)`);
			return;
		}
		const lookup = lookupFor(spec);
		const groups = new Map();
		const missing = [];
		for (const element of named.elements) {
			const name = (element.propertyName ?? element.name).text;
			const files = lookup(name);
			if (files.length !== 1) {
				const where = files.map((f) => path.posix.relative(root, f)).join(", ");
				missing.push(
					files.length === 0
						? `${name} is exported by no package file`
						: `${name} is exported by ${where}`,
				);
				continue;
			}
			const rel = relTo(path.posix.relative(root, files[0]));
			if (!groups.has(rel)) groups.set(rel, []);
			groups.get(rel).push(element);
		}
		if (missing.length > 0) {
			for (const reason of missing)
				unresolved.push(`${to}: ${reason} (import from ${spec} left as is)`);
			return;
		}
		const keyword = isImport ? "import" : "export";
		const declarationTypeOnly = isImport ? clause.isTypeOnly : node.isTypeOnly;
		const lines = [];
		for (const [rel, elements] of groups) {
			// A group left with only inline `type` elements is written as `import type` (or
			// `export type`): under verbatimModuleSyntax `import { type X } from` still emits a
			// runtime `import {} from`. A mixed group keeps its inline modifiers.
			const typeOnly = declarationTypeOnly || elements.every((element) => element.isTypeOnly);
			const shown = elements.map((element) =>
				typeOnly && element.isTypeOnly
					? element.getText().slice("type".length).trimStart()
					: element.getText(),
			);
			lines.push(`${keyword}${typeOnly ? " type" : ""} { ${shown.join(", ")} } from "${rel}";`);
			rewrites.push(`${spec} { ${shown.join(", ")} } -> ${rel}`);
		}
		edits.push([node.getStart(), node.end, lines.join(NL)]);
	};

	const visit = (node) => {
		const declaration =
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier);
		const dynamic =
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments.length > 0 &&
			ts.isStringLiteral(node.arguments[0]);
		const spec = declaration ? node.moduleSpecifier : dynamic ? node.arguments[0] : null;
		if (spec) {
			const id = moduleIdOf(spec.text, source);
			if (id && placed.has(id)) {
				const rel = relTo(`src/${placed.get(id)}`);
				edits.push([spec.getStart() + 1, spec.end - 1, rel]);
				rewrites.push(`${spec.text} -> ${rel}`);
			} else if (entries[spec.text]) {
				if (declaration) splitEntry(node);
				else
					unresolved.push(
						`${to}: import("${spec.text}") of an entry (point it at the file by hand)`,
					);
			} else if (id) unresolved.push(`${to}: ${spec.text}`);
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument) &&
			ts.isStringLiteral(node.argument.literal)
		) {
			const literal = node.argument.literal.text;
			if (entries[literal] || moduleIdOf(literal, source)) {
				unresolved.push(`${to}: import("${literal}") type (edit it by hand)`);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(parse(source, text));
	let out = text;
	for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) {
		out = out.slice(0, start) + value + out.slice(end);
	}
	if (out.includes("import.meta.url")) {
		unresolved.push(`${to}: uses import.meta.url (check the worker URL by hand)`);
	}
	return { text: out, rewrites, unresolved };
}

/** A component is placed one script block at a time; its markup and styles are copied as they are. */
export function placeText(args) {
	if (!args.source.endsWith(".svelte")) return placeScript(args);
	let text = args.text;
	const rewrites = [];
	const unresolved = [];
	for (const [start, end] of [...scriptBlocks(text)].reverse()) {
		const result = placeScript({ ...args, text: text.slice(start, end) });
		text = text.slice(0, start) + result.text + text.slice(end);
		rewrites.push(...result.rewrites);
		unresolved.push(...result.unresolved);
	}
	return { text, rewrites, unresolved };
}

/**
 * `import X from "<moved>.svelte"` names the component through the entry instead. With `file`, the
 * importing tka file, a relative specifier is compared by its `$lib` module id; without it the
 * specifier must equal `from` as written.
 */
export function rewriteDefaultComponentImport(line, from, entry, file) {
	const match = line.match(
		/^(\s*)import\s+([A-Za-z_][A-Za-z0-9_]*)\s+from\s+["']([^"']+)["'];?\s*$/,
	);
	if (!match || !from.endsWith(".svelte")) return line;
	if ((file === undefined ? match[3] : moduleIdOf(match[3], file)) !== from) return line;
	const exported = from.slice(from.lastIndexOf("/") + 1, -".svelte".length);
	const local = match[2];
	const name = local === exported ? exported : `${exported} as ${local}`;
	return `${match[1]}import { ${name} } from "${entry}";`;
}

/**
 * Imports inside the package that go through a barrel of their own: a file under src/ importing
 * the index.js of its own folder or of a folder above it, or the package by name. Each is an import
 * cycle through the barrel. `overlay` maps file paths to text that replaces (or adds to) what is on
 * disk, so a dry run can check what it would write.
 */
export function barrelImports(root = PKG, overlay = new Map()) {
	const files = new Set([...walk(`${root}/src`, [".ts", ".svelte"]), ...overlay.keys()]);
	const found = [];
	for (const file of [...files].sort()) {
		const text = overlay.has(file) ? overlay.get(file) : fs.readFileSync(file, "utf8");
		for (const spec of specifiersOf(file, text)) {
			const where = `${path.posix.relative(root, file)}:${spec.line}`;
			if (spec.text === PACKAGE || spec.text.startsWith(`${PACKAGE}/`)) {
				found.push(`${where}: ${spec.text} (the package importing itself by name)`);
				continue;
			}
			if (!spec.text.startsWith(".")) continue;
			const target = path.posix
				.join(path.posix.dirname(file), spec.text)
				.replace(/[.](js|ts)$/, "");
			if (path.posix.basename(target) !== "index" || `${target}.ts` === file) continue;
			if (file.startsWith(`${path.posix.dirname(target)}/`)) {
				found.push(`${where}: ${spec.text} (a barrel of its own folder)`);
			}
		}
	}
	return found;
}

export function walk(dir, exts, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const full = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walk(full, exts, out);
		else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
	}
	return out;
}
