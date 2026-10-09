import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const IMPORT = /(?:import|export)([^"']*)from[ ]*"([^"]+)"/g;
const RUNTIME_ZOD = /import[ ]+(?!type[ ])[^"']*from[ ]*"zod"/;

/** Every package file a module loads at run time, following relative imports. */
function closure(entry) {
	const seen = new Set();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (seen.has(file)) continue;
		seen.add(file);
		for (const [, clause, spec] of fs.readFileSync(file, "utf8").matchAll(IMPORT)) {
			if (!spec.startsWith(".") || clause.trimStart().startsWith("type ")) continue;
			queue.push(path.resolve(path.dirname(file), spec.replace(/[.]js$/, ".ts")));
		}
	}
	return [...seen];
}

test("the preview worker loads no zod", () => {
	const files = closure(path.join(SRC, "workers", "preview-video.worker.ts"));
	const withZod = files.filter((file) => RUNTIME_ZOD.test(fs.readFileSync(file, "utf8")));
	assert.deepEqual(
		withZod.map((file) => path.relative(SRC, file).split(path.sep).join("/")),
		[],
	);
});
