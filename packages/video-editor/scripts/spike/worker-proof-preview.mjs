import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { withHeadlessPage } from "./cdp.mjs";

// usage: node worker-proof.mjs <sveltekit client output dir> [port]
// Serves a production client build statically, loads the emitted
// spike worker chunk from a bare page, and checks its reply. This
// runs the built worker without the app's auth gates or dev-only route guards.
// It also requires that some other module under _app/immutable names the
// chunk, so the proof covers the app pointing at the worker and not only the
// worker running.
const [clientDir, portArg] = process.argv.slice(2);
if (!clientDir) {
  console.error("usage: node worker-proof.mjs <clientDir> [port]");
  process.exit(2);
}
const root = resolve(clientDir);
const port = Number(portArg ?? 18444);
const immutableDir = join(root, "_app/immutable");
const workersDir = join(immutableDir, "workers");
// The host app may ship its own workers (tka has a preview-video worker), so
// the package chunk is picked by its name and its ping handler.
const answersPing = (file) =>
  readFileSync(join(workersDir, file), "utf8").includes(
    "The preview encoder produced no usable file",
  );
const chunks = existsSync(workersDir)
  ? readdirSync(workersDir).filter(
      (file) =>
        file.startsWith("preview-video.worker") &&
        file.endsWith(".js") &&
        answersPing(file),
    )
  : [];
if (chunks.length !== 1) {
  console.error(
    `expected exactly one preview-video.worker chunk with its handler under ${workersDir}, found ${chunks.length}:`,
  );
  console.error(JSON.stringify(chunks));
  process.exit(1);
}
const worker = chunks[0];
console.log("worker chunk:", worker);

const referencedBy = readdirSync(immutableDir, { recursive: true })
  .map((entry) => entry.replaceAll("\\", "/"))
  .filter((entry) => entry.endsWith(".js") && !entry.startsWith("workers/"))
  .find((entry) => {
    const file = join(immutableDir, entry);
    return (
      statSync(file).isFile() && readFileSync(file, "utf8").includes(worker)
    );
  });
if (!referencedBy) {
  console.log(`FAIL: no module references ${worker}`);
  process.exit(1);
}
console.log("referenced by:", `_app/immutable/${referencedBy}`);

const html = `<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><body><script type="module">
const worker = new Worker("/_app/immutable/workers/${worker}", { type: "module" });
worker.onmessage = (event) => { document.body.dataset.result = JSON.stringify(event.data); };
worker.onerror = (event) => { document.body.dataset.result = "error:" + (event.message || "worker failed to load"); };
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
  response.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

try {
  const { result, errors } = await withHeadlessPage(
    `http://127.0.0.1:${port}/proof.html`,
    async (page) => {
      const result = await page.waitFor(
        "document.body.dataset.result || null",
        30_000,
      );
      return { result, errors: page.consoleErrors() };
    },
  );
  console.log("worker reply:", result);
  console.log("console errors:", JSON.stringify(errors));
  const ok = result.includes('"type":"error"') && result.includes('"reason":');
  console.log(ok ? "PASS" : "FAIL");
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  server.close();
}
