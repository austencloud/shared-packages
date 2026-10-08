import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FORBIDDEN_PORTS = new Set([9222, 9333]);
const SEND_TIMEOUT_MS = 30_000;

/**
 * Opens `url` in a private headless Chrome on an OS-assigned port, hands the
 * callback evaluate / waitFor / screenshot / consoleErrors helpers, then kills
 * that Chrome's whole process tree. The port comes from the profile's own
 * DevToolsActivePort file, so parallel proofs cannot attach to each other's
 * Chrome. Never attaches to 9222 or 9333.
 */
export async function withHeadlessPage(url, fn, { timeoutMs = 30_000 } = {}) {
	const profile = mkdtempSync(join(tmpdir(), "ve-spike-"));
	const chrome = spawn(
		CHROME,
		[
			"--headless=new",
			"--remote-debugging-port=0",
			`--user-data-dir=${profile}`,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-gpu",
			"--window-size=1280,900",
			"--ignore-certificate-errors",
			"about:blank",
		],
		{ stdio: "ignore" },
	);
	let ws;
	try {
		const target = await waitForTarget(profile, timeoutMs);
		ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			ws.onopen = resolve;
			ws.onerror = () => reject(new Error("CDP websocket failed to open"));
		});
		let nextId = 0;
		const pending = new Map();
		const events = [];
		ws.onclose = () => {
			for (const entry of pending.values()) {
				clearTimeout(entry.timer);
				entry.reject(new Error("CDP websocket closed"));
			}
			pending.clear();
		};
		ws.onmessage = (message) => {
			const msg = JSON.parse(message.data);
			if (msg.id && pending.has(msg.id)) {
				const { resolve, reject, timer } = pending.get(msg.id);
				clearTimeout(timer);
				pending.delete(msg.id);
				msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
			} else if (msg.method) {
				events.push(msg);
				if (msg.method === "Target.attachedToTarget") {
					send("Runtime.enable", {}, msg.params.sessionId).catch(() => {});
					send("Log.enable", {}, msg.params.sessionId).catch(() => {});
				}
			}
		};
		const send = (method, params = {}, sessionId) =>
			new Promise((resolve, reject) => {
				if (ws.readyState !== WebSocket.OPEN) {
					reject(new Error("CDP websocket is not open"));
					return;
				}
				const id = ++nextId;
				const timer = setTimeout(() => {
					pending.delete(id);
					reject(new Error(`CDP ${method} timed out after ${SEND_TIMEOUT_MS / 1000} s`));
				}, SEND_TIMEOUT_MS);
				pending.set(id, { resolve, reject, timer });
				ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
			});
		await send("Page.enable");
		await send("Runtime.enable");
		await send("Log.enable");
		await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
		const navigation = await send("Page.navigate", { url });
		if (navigation.errorText) throw new Error("navigation failed: " + navigation.errorText);

		const evaluate = async (expression) => {
			const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
			if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed");
			return result.result.value;
		};
		const waitFor = async (expression, ms = timeoutMs) => {
			const end = Date.now() + ms;
			while (Date.now() < end) {
				const value = await evaluate(expression).catch((error) => {
					if (ws.readyState !== WebSocket.OPEN) throw error;
					return null;
				});
				if (value) return value;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
			throw new Error(`timed out after ${ms} ms waiting for: ${expression}`);
		};
		const screenshot = async (file) => {
			const result = await send("Page.captureScreenshot", { format: "png" });
			writeFileSync(file, Buffer.from(result.data, "base64"));
		};
		const consoleErrors = () =>
			events
				.filter(
					(event) =>
						event.method === "Runtime.exceptionThrown" ||
						(event.method === "Runtime.consoleAPICalled" && event.params.type === "error") ||
						(event.method === "Log.entryAdded" && event.params.entry.level === "error"),
				)
				.map((event) => JSON.stringify(event.params).slice(0, 400));

		return await fn({ evaluate, waitFor, screenshot, consoleErrors });
	} finally {
		try {
			ws?.close();
		} catch {
			// The socket may already be closed.
		}
		if (chrome.exitCode === null && chrome.signalCode === null) {
			if (process.platform === "win32") {
				const killer = spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
				await once(killer, "exit");
			} else {
				chrome.kill();
				await once(chrome, "exit");
			}
		}
		// Node 24's rmSync on Windows fails at once with EPERM and does not honor
		// maxRetries while Chrome's killed processes still hold the profile. They
		// usually let go within a few seconds but have taken more than ten, so
		// retry here for up to thirty.
		for (const deadline = Date.now() + 30_000; ; ) {
			try {
				rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
				break;
			} catch {
				// A leftover temp folder is harmless if every retry fails.
				if (Date.now() >= deadline) break;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}
	}
}

async function waitForTarget(profile, timeoutMs) {
	const end = Date.now() + timeoutMs;
	let port = 0;
	while (Date.now() < end) {
		if (!port) port = readDebuggingPort(join(profile, "DevToolsActivePort"));
		if (port) {
			if (FORBIDDEN_PORTS.has(port)) throw new Error(`Chrome picked reserved debugging port ${port}; refusing to attach`);
			try {
				const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
				const page = list.find((target) => target.type === "page");
				if (page) return page;
			} catch {
				// Chrome is still starting.
			}
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error(`Chrome exposed no page target (port ${port || "not reported"}) within ${timeoutMs} ms`);
}

// DevToolsActivePort holds the port on its first line and the browser socket
// path on its second. Wait for both lines so a half-written file is ignored.
function readDebuggingPort(file) {
	try {
		const lines = readFileSync(file, "utf8").split(/\r?\n/);
		const port = Number(lines[0]);
		return lines.length >= 2 && Number.isInteger(port) && port > 0 ? port : 0;
	} catch {
		return 0;
	}
}
