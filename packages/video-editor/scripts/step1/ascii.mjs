import fs from "node:fs";
import ts from "typescript";
import { parse } from "./lib.mjs";

const BACKSLASH = String.fromCharCode(92);
const EM_DASH = 0x2014;
// An em dash becomes a hyphen with a space on each side, except where a space is already there:
// "word - word" stays one space wide and "word-word" gains the two.
const spacedHyphen = (text, i) => {
	const open = (char) => char === undefined || /\s/.test(char);
	return `${open(text[i - 1]) ? "" : " "}-${open(text[i + 1]) ? "" : " "}`;
};
const COMMENT = new Map([
	[0x2013, "-"],
	[0x2212, "-"],
	[0x2192, "->"],
	[0x2190, "<-"],
	[0x21d2, "=>"],
	[0x2026, "..."],
	[0x00d7, "x"],
	[0x2018, "'"],
	[0x2019, "'"],
	[0x201c, '"'],
	[0x201d, '"'],
	[0x2264, "<="],
	[0x2265, ">="],
	[0x2248, "~"],
	[0x00b0, " deg"],
	[0x00b7, "-"],
	[0x2022, "*"],
	[0x03a8, "Psi"],
	[0x00a0, " "],
	[0x00b1, "+/-"],
]);
const LITERALS = new Set([
	ts.SyntaxKind.StringLiteral,
	ts.SyntaxKind.NoSubstitutionTemplateLiteral,
	ts.SyntaxKind.TemplateHead,
	ts.SyntaxKind.TemplateMiddle,
	ts.SyntaxKind.TemplateTail,
	ts.SyntaxKind.RegularExpressionLiteral,
]);
let failed = false;
for (const file of process.argv.slice(2)) {
	let fileFailed = false;
	const text = fs.readFileSync(file, "utf8");
	const ranges = [];
	const visit = (node) => {
		if (LITERALS.has(node.kind)) ranges.push([node.getStart(), node.end]);
		ts.forEachChild(node, visit);
	};
	visit(parse(file, text));
	const inLiteral = (i) => ranges.some(([a, b]) => i >= a && i < b);
	let out = "";
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 128) {
			out += text[i];
			continue;
		}
		if (inLiteral(i)) {
			out += `${BACKSLASH}u${code.toString(16).padStart(4, "0")}`;
			continue;
		}
		const swap = code === EM_DASH ? spacedHyphen(text, i) : COMMENT.get(code);
		if (swap === undefined) {
			const line = text.slice(0, i).split(String.fromCharCode(10)).length;
			console.error(
				`${file}:${line}: no ASCII rule for U+${code.toString(16).padStart(4, "0")} outside a literal`,
			);
			failed = true;
			fileFailed = true;
			out += "?";
		} else out += swap;
	}
	if (fileFailed) console.error(`${file}: left unchanged`);
	else fs.writeFileSync(file, out);
}
process.exit(failed ? 1 : 0);
