import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/**
 * Opens `url` in a private headless Chrome on a random high port, hands the
 * callback evaluate / waitFor / screenshot / consoleErrors helpers, then kills
 * that Chrome's whole process tree. Never attaches to 9222 or 9333.
 */
export async function withHeadlessPage(url, fn, { timeoutMs = 30_000 } = {}) {
	const port = 19333 + Math.floor(Math.random() * 1000);
	const profile = mkdtempSync(join(tmpdir(), "ve-spike-"));
	const chrome = spawn(
		CHROME,
		[
			"--headless=new",
			`--remote-debugging-port=${port}`,
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
	try {
		const target = await waitForTarget(port, timeoutMs);
		const ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			ws.onopen = resolve;
			ws.onerror = () => reject(new Error("CDP websocket failed to open"));
		});
		let nextId = 0;
		const pending = new Map();
		const events = [];
		ws.onmessage = (message) => {
			const msg = JSON.parse(message.data);
			if (msg.id && pending.has(msg.id)) {
				const { resolve, reject } = pending.get(msg.id);
				pending.delete(msg.id);
				msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
			} else if (msg.method) {
				events.push(msg);
			}
		};
		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const id = ++nextId;
				pending.set(id, { resolve, reject });
				ws.send(JSON.stringify({ id, method, params }));
			});
		await send("Page.enable");
		await send("Runtime.enable");
		await send("Log.enable");
		await send("Page.navigate", { url });

		const evaluate = async (expression) => {
			const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
			if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "evaluate failed");
			return result.result.value;
		};
		const waitFor = async (expression, ms = timeoutMs) => {
			const end = Date.now() + ms;
			while (Date.now() < end) {
				const value = await evaluate(expression).catch(() => null);
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
		if (process.platform === "win32") {
			spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
		} else {
			chrome.kill();
		}
		await new Promise((resolve) => setTimeout(resolve, 800));
		try {
			rmSync(profile, { recursive: true, force: true });
		} catch {
			// Chrome can hold the profile a moment longer; a leftover temp folder is harmless.
		}
	}
}

async function waitForTarget(port, timeoutMs) {
	const end = Date.now() + timeoutMs;
	while (Date.now() < end) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			const page = list.find((target) => target.type === "page");
			if (page) return page;
		} catch {
			// Chrome is still starting.
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error(`Chrome exposed no page target on port ${port} within ${timeoutMs} ms`);
}
