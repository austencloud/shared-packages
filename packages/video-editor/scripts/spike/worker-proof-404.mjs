import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { withHeadlessPage } from "./cdp.mjs";

// usage: node worker-proof-404.mjs <sveltekit client output dir> [port]
// The failed-source companion of worker-proof-preview.mjs. It asks the built
// preview worker for a recording the static server answers with 404, and passes
// only when the worker replies with an error exactly once and the console shows
// nothing: no "Uncaught (in promise)" and no other error. worker-proof-preview.mjs
// itself passes on the error reply alone and keeps doing so.
const [clientDir, portArg] = process.argv.slice(2);
if (!clientDir) {
	console.error("usage: node worker-proof-404.mjs <clientDir> [port]");
	process.exit(2);
}
const root = resolve(clientDir);
const port = Number(portArg ?? 18444);
const workersDir = join(root, "_app/immutable/workers");
// The host app may ship its own workers, so the package chunk is picked by its
// name and by a string only the preview handler holds.
const isPreviewWorker = (file) =>
	file.startsWith("preview-video.worker") &&
	file.endsWith(".js") &&
	readFileSync(join(workersDir, file), "utf8").includes(
		"The preview encoder produced no usable file",
	);
const chunks = existsSync(workersDir) ? readdirSync(workersDir).filter(isPreviewWorker) : [];
if (chunks.length !== 1) {
	console.error(
		`expected exactly one preview-video.worker chunk under ${workersDir}, found ${chunks.length}:`,
	);
	console.error(JSON.stringify(chunks));
	process.exit(1);
}
const worker = chunks[0];
console.log("worker chunk:", worker);

// The page collects every reply and reports once a second has passed after the
// first, so a second reply or a late rejection is still counted.
const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><body><script type="module">
const replies = [];
const worker = new Worker("/_app/immutable/workers/${worker}", { type: "module" });
worker.onmessage = (event) => {
	replies.push(event.data);
	if (replies.length === 1) setTimeout(() => { document.body.dataset.result = JSON.stringify(replies); }, 1000);
};
worker.onerror = (event) => { replies.push({ type: "worker-error", message: event.message }); };
worker.postMessage({ sourceUrl: location.origin + "/missing.mp4" });
</script></body>`;
const types = {
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".wasm": "application/wasm",
	".json": "application/json",
	".html": "text/html",
};
const server = createServer((request, response) => {
	const path = decodeURIComponent(new URL(request.url, "http://x").pathname);
	if (path === "/proof.html") {
		response.writeHead(200, { "content-type": "text/html" });
		return response.end(html);
	}
	const file = resolve(root, "." + path);
	const rel = relative(root, file);
	if (
		rel.startsWith("..") ||
		isAbsolute(rel) ||
		!existsSync(file) ||
		statSync(file).isDirectory()
	) {
		response.writeHead(404);
		return response.end();
	}
	response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
	response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

try {
	const { replies, errors } = await withHeadlessPage(
		`http://127.0.0.1:${port}/proof.html`,
		async (page) => {
			const result = await page.waitFor("document.body.dataset.result || null", 30_000);
			return { replies: JSON.parse(result), errors: page.consoleErrors() };
		},
	);
	console.log("worker replies:", JSON.stringify(replies));
	console.log("console errors:", JSON.stringify(errors));
	const ok =
		replies.length === 1 &&
		replies[0].type === "error" &&
		String(replies[0].reason).includes("404") &&
		errors.length === 0;
	console.log(ok ? "PASS" : "FAIL");
	process.exitCode = ok ? 0 : 1;
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
} finally {
	server.close();
}
