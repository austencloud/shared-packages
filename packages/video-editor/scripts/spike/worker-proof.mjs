import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { withHeadlessPage } from "./cdp.mjs";

// usage: node worker-proof.mjs <sveltekit client output dir> [port]
// Serves a production client build statically, loads the emitted
// preview-video worker chunk from a bare page, and checks its reply. This
// runs the built worker without the app's auth gates or dev-only route guards.
const [clientDir, portArg] = process.argv.slice(2);
if (!clientDir) {
	console.error("usage: node worker-proof.mjs <clientDir> [port]");
	process.exit(2);
}
const root = resolve(clientDir);
const port = Number(portArg ?? 18444);
const workersDir = join(root, "_app/immutable/workers");
const worker = existsSync(workersDir)
	? readdirSync(workersDir).find((file) => file.startsWith("preview-video.worker") && file.endsWith(".js"))
	: undefined;
if (!worker) {
	console.error(`no preview-video.worker chunk under ${workersDir}`);
	process.exit(1);
}
console.log("worker chunk:", worker);

const html = `<!doctype html><meta charset="utf-8"><body><script type="module">
const worker = new Worker("/_app/immutable/workers/${worker}", { type: "module" });
worker.onmessage = (event) => { document.body.dataset.result = JSON.stringify(event.data); };
worker.onerror = (event) => { document.body.dataset.result = "error:" + event.message; };
worker.postMessage({ type: "ping", seconds: 83.5 });
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
	if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
		response.writeHead(404);
		return response.end();
	}
	response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
	response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

try {
	const result = await withHeadlessPage(`http://127.0.0.1:${port}/proof.html`, (page) =>
		page.waitFor("document.body.dataset.result || null", 30_000),
	);
	console.log("worker reply:", result);
	const ok = result.includes('"timecode":"1:23.500"') && result.includes('"mediabunny":true');
	console.log(ok ? "PASS" : "FAIL");
	process.exitCode = ok ? 0 : 1;
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
} finally {
	server.close();
}
