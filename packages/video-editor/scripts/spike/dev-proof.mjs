import { spawn } from "node:child_process";
import { checkSpikePage } from "./page-proof.mjs";

// usage: node dev-proof.mjs --url <url> --shot <png> --cwd <dir> -- <dev server command...>
// Starts the dev server, waits for Vite's ready line, runs the page proof,
// then kills only the process tree it started.
const args = process.argv.slice(2);
const separator = args.indexOf("--");
if (separator < 0) {
	console.error("usage: node dev-proof.mjs --url <url> --shot <png> --cwd <dir> -- <command...>");
	process.exit(2);
}
const options = {};
for (let i = 0; i < separator; i += 2) options[args[i].replace(/^--/, "")] = args[i + 1];
const command = args.slice(separator + 1).join(" ");

const child = spawn(command, { cwd: options.cwd ?? process.cwd(), shell: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
const ready = new Promise((resolve, reject) => {
	const onData = (chunk) => {
		const text = chunk.toString();
		log += text;
		process.stdout.write(text);
		if (/ready in|Local:/.test(log)) resolve();
	};
	child.stdout.on("data", onData);
	child.stderr.on("data", onData);
	child.on("exit", (code) => reject(new Error(`dev server exited with ${code}\n${log.slice(-2000)}`)));
	setTimeout(() => reject(new Error("dev server did not report ready within 240 s")), 240_000).unref();
});

let ok = false;
try {
	await ready;
	ok = await checkSpikePage(options.url, options.shot);
} catch (error) {
	console.error(error.message);
} finally {
	spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
}
process.exitCode = ok ? 0 : 1;
