import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { checkSpikePage } from "./page-proof.mjs";

// usage: node dev-proof.mjs --url <url> --shot <png> --cwd <dir> -- node <script> [args]
// Refuses to start if something already listens on the URL's host and port.
// Otherwise starts the dev server (node only, no shell, so it dies with this
// process), waits for Vite's ready line, runs the page proof, then kills only
// the process tree it started.
const usage = "usage: node dev-proof.mjs --url <url> --shot <png> --cwd <dir> -- node <script> [args]";
const args = process.argv.slice(2);
const separator = args.indexOf("--");
if (separator < 0) {
	console.error(usage);
	process.exit(2);
}
const options = {};
for (let i = 0; i < separator; i += 2) options[args[i].replace(/^--/, "")] = args[i + 1];
const [program, ...programArgs] = args.slice(separator + 1);
if (!options.url || program !== "node") {
	console.error(usage);
	process.exit(2);
}

// A URL with no host (a data: URL) has nothing to probe.
const target = new URL(options.url);
if (target.hostname) {
	const host = target.hostname.replace(/^\[|\]$/g, "");
	const port = Number(target.port || (target.protocol === "https:" ? 443 : 80));
	if (await isListening(host, port)) {
		console.error(`refusing to start: something already listens on ${host}:${port}`);
		process.exit(3);
	}
}

const child = spawn(process.execPath, programArgs, {
	cwd: options.cwd ?? process.cwd(),
	shell: false,
	stdio: ["ignore", "pipe", "pipe"],
});
console.log(`dev server root PID ${child.pid}`);
let log = "";
const ready = new Promise((resolve, reject) => {
	const onData = (chunk) => {
		const text = chunk.toString();
		log += text;
		process.stdout.write(text);
		if (/\bready in \d+\s*ms\b/.test(log.replace(/\x1b\[[0-9;]*m/g, ""))) resolve();
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
	if (ok && child.exitCode !== null) console.error("dev server exited during the check");
	ok = ok && child.exitCode === null;
} catch (error) {
	console.error(error.message);
} finally {
	if (child.exitCode === null) {
		const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
		await once(killer, "exit");
	}
}
process.exitCode = ok ? 0 : 1;

// Connects and disconnects; it never sends data and never kills anything.
function isListening(host, port) {
	return new Promise((resolve) => {
		const socket = net.connect({ host, port });
		const finish = (listening) => {
			socket.destroy();
			resolve(listening);
		};
		socket.once("connect", () => finish(true));
		socket.once("error", () => finish(false));
		socket.setTimeout(2000, () => finish(false));
	});
}
