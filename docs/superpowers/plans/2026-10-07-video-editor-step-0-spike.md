# Video Editor Step 0: Package Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that a Svelte component, a module worker and a token stylesheet published from `@austencloud/video-editor` load and run in both tka-platform and Ringmaster, in their dev servers and in their production builds, before any editor code moves.

**Architecture:** A new `packages/video-editor` in the shared-packages monorepo (svelte-package build to `dist/`, `css/` beside it) holds a placeholder `VideoEditor.svelte`, a `./core` entry with `formatTimecode`, and `workers/preview-video.worker.ts`, which imports both a package-internal module and the `mediabunny` dependency. Both apps resolve the package through `kit.alias` entries pointing at the worktree's `dist/` (SvelteKit turns these into Vite aliases and tsconfig `paths`), dedupe `svelte` and `mediabunny` so one runtime copy serves the package, and exclude the package from dependency pre-bundling. A spike route in each app renders the component; headless-Chrome scripts prove the worker reply on the dev servers and on the built client output.

**Tech Stack:** pnpm 9 workspace, `@sveltejs/package` 2, Svelte 5, TypeScript 5 strict, Node 24 (`node --test`, global `fetch` and `WebSocket`), Vite 6, SvelteKit 2, headless Chrome over CDP.

**Spec:** `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md` (sections Package anatomy, Dev loop and publishing, Steps and exit criteria, Risks).

---

## Ground rules for every task

- Three worktrees, never a primary checkout:
  - shared-packages: `E:/worktrees/shared-packages/video-editor` (branch `video-editor`)
  - tka-platform: `E:/worktrees/tka-platform/video-editor` (branch `codex/video-editor`; `node_modules` is a junction into `E:/tka-platform/node_modules`, never delete it)
  - cirque-aflame: `E:/worktrees/cirque-aflame/video-editor` (branch `video-editor`; `node_modules`, `cirque-website/node_modules` and `mcp-server/node_modules` are junctions into `E:/cirque-aflame`)
- Commit with explicit pathspecs only. Never `git add -A`, never `git add .`, never stash.
- No em dashes and no emojis in any file or commit message.
- Commit messages end with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Dev servers for proofs are started and stopped by `scripts/spike/dev-proof.mjs`, which kills only the process tree it spawned. Never kill a process by port. Ports 3000, 1871 and 5173 belong to Austen; the spike uses 5221 (tka), 5222 (Ringmaster), 18444 and 18445 (static proof servers). Before starting a server, confirm the port is free: `netstat -ano | grep ":5221 "` must print no LISTENING line. `dev-proof.mjs` also refuses to start (exit 3) when something already listens on the URL port, and the command after `--` must begin with `node`, which it spawns directly so the server dies with the proof. Run each dev-proof and each build from Bash with `timeout: 600000`.
- Before a build or svelte-check, confirm at least 4096 MB of memory is available and no other `svelte-check` is running:
  ```powershell
  (Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'svelte-check' } | Select-Object ProcessId, CommandLine
  ```
- Expected outputs below are the shape to look for; version numbers and timings differ.

---

### Task 1: Bring the tka worktree branch current with local main

tka `main` moved after the worktree was created (worktree base `9e97567654`, `main` now at `4ebd2662d7` or later). Merging now keeps the later `wt:finish` merge small.

**Files:** none edited by hand.

- [ ] **Step 1: Check the worktree is clean and see the gap**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && git status --short && git log --oneline -1 && git log --oneline codex/video-editor..main | wc -l
```
Expected: no status lines, the branch's head, and a count of commits `main` is ahead (0 or more).

- [ ] **Step 2: Merge local main into the branch**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && git merge --no-edit main && git log --oneline -1 && git status --short
```
Expected: `Already up to date.` or a merge summary, then a clean status. If the merge reports conflicts, stop and report them; do not resolve by discarding either side.

---

### Task 2: Package skeleton with a failing core test

**Files:**
- Create: `packages/video-editor/package.json`
- Create: `packages/video-editor/tsconfig.json`
- Create: `packages/video-editor/README.md`
- Create: `packages/video-editor/css/video-editor-tokens.css`
- Create: `packages/video-editor/src/core/index.ts`
- Create: `packages/video-editor/src/core/timecode.ts`
- Create: `packages/video-editor/src/workers/messages.ts`
- Create: `packages/video-editor/src/workers/preview-video.worker.ts`
- Create: `packages/video-editor/src/workers/index.ts`
- Create: `packages/video-editor/src/runtime-probe.ts`
- Create: `packages/video-editor/src/ui/VideoEditor.svelte`
- Create: `packages/video-editor/src/index.ts`
- Test: `packages/video-editor/test/core.test.mjs`

All paths in this task are under `E:/worktrees/shared-packages/video-editor/`.

- [ ] **Step 1: Write the failing core test**

Create `packages/video-editor/test/core.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { formatTimecode, VIDEO_EDITOR_VERSION } from "../dist/core/index.js";

test("formatTimecode renders m:ss.mmm", () => {
  assert.equal(formatTimecode(0), "0:00.000");
  assert.equal(formatTimecode(83.5), "1:23.500");
  assert.equal(formatTimecode(600.0071), "10:00.007");
});

test("formatTimecode carries a rounded second and clamps negatives", () => {
  assert.equal(formatTimecode(59.9996), "1:00.000");
  assert.equal(formatTimecode(-2), "0:00.000");
});

test("the package reports its version", () => {
  assert.equal(VIDEO_EDITOR_VERSION, "0.1.0");
});
```

- [ ] **Step 2: Run the test to see it fail**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node --test test/core.test.mjs
```
Expected: FAIL with `Cannot find module '.../dist/core/index.js'` (no dist yet).

- [ ] **Step 3: Write package.json**

Create `packages/video-editor/package.json`:
```json
{
  "name": "@austencloud/video-editor",
  "version": "0.1.0",
  "description": "Keyframe video editor for Svelte 5 apps: project schema, frame compositor, WebCodecs export and the editor UI. Shared by tka-platform and Ringmaster.",
  "type": "module",
  "svelte": "./dist/index.js",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "import": "./dist/index.js"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js"
    },
    "./css/*": "./css/*"
  },
  "sideEffects": [
    "./css/*"
  ],
  "files": [
    "dist",
    "css"
  ],
  "scripts": {
    "build": "svelte-package -i src -o dist",
    "dev": "svelte-package -i src -o dist --watch",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "node --test test/*.test.mjs",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "mediabunny": "^1.44.0"
  },
  "peerDependencies": {
    "svelte": "^5.0.0"
  },
  "devDependencies": {
    "@sveltejs/package": "^2.3.0",
    "rimraf": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.0.0"
  },
  "keywords": [
    "svelte",
    "video",
    "editor",
    "keyframes",
    "webcodecs",
    "austencloud"
  ],
  "author": "Austen Cloud <austencloud@gmail.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/austencloud/shared-packages.git",
    "directory": "packages/video-editor"
  }
}
```

- [ ] **Step 4: Write tsconfig.json and README.md**

Create `packages/video-editor/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["svelte"]
  },
  "include": ["src/**/*", "src/**/*.svelte"],
  "exclude": ["node_modules", "dist"]
}
```

Create `packages/video-editor/README.md`:
```markdown
# @austencloud/video-editor

Keyframe video editor for Svelte 5 apps. Extracted from tka-platform's Post Studio so tka-platform and Ringmaster run the same editor.

Status: step 0 spike. The package ships a placeholder `VideoEditor` component, a `./core` entry with `formatTimecode`, and a module worker that proves the packaging works in a host app. The design lives in `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md`.

## Entry points

- `@austencloud/video-editor`: `VideoEditor` component, `createPreviewWorker`, `runtimeProbe`
- `@austencloud/video-editor/core`: `formatTimecode`, `VIDEO_EDITOR_VERSION`
- `@austencloud/video-editor/css/video-editor-tokens.css`: `--ve-*` tokens with dark fallbacks, mapped to `--theme-*` when the host defines them

## Host requirements

- `resolve.dedupe: ["svelte", "mediabunny"]` in the host's Vite config, so the package shares the host's copies
- `optimizeDeps.exclude: ["@austencloud/video-editor"]`, because the package ships `.svelte` files and a module worker that the host's Vite compiles
```

- [ ] **Step 5: Write the token stylesheet**

Create `packages/video-editor/css/video-editor-tokens.css`:
```css
/*
 * Tokens read by @austencloud/video-editor components.
 * Each --ve-* value takes the host's --theme-* token when the host defines it
 * and falls back to a dark default otherwise.
 * Import once in the host: import "@austencloud/video-editor/css/video-editor-tokens.css";
 */

:root {
	--ve-bg: var(--theme-panel-bg, #15151a);
	--ve-surface: var(--theme-card-bg, #1e1e25);
	--ve-surface-hover: var(--theme-card-hover-bg, #26262f);
	--ve-text: var(--theme-text, #f3f3f5);
	--ve-text-dim: var(--theme-text-dim, #9a9aa5);
	--ve-stroke: var(--theme-stroke, rgba(255, 255, 255, 0.12));
	--ve-stroke-strong: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
	--ve-accent: var(--theme-accent, #f97316);
	--ve-radius: 12px;
	--ve-font: var(--theme-font, system-ui, sans-serif);
}
```

- [ ] **Step 6: Write the core entry**

Create `packages/video-editor/src/core/timecode.ts`:
```ts
/**
 * Formats a time in seconds as m:ss.mmm for timeline labels and status text.
 * Negative input clamps to zero. Milliseconds that round up to a full second
 * carry into the seconds field, so 59.9996 reads 1:00.000 and never 0:60.000.
 */
export function formatTimecode(seconds: number): string {
	const total = Math.max(0, seconds);
	const minutes = Math.floor(total / 60);
	const rest = total - minutes * 60;
	const whole = Math.floor(rest);
	const millis = Math.round((rest - whole) * 1000);
	if (millis === 1000) return formatTimecode(minutes * 60 + whole + 1);
	return `${minutes}:${String(whole).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
```

Create `packages/video-editor/src/core/index.ts`:
```ts
export const VIDEO_EDITOR_VERSION = "0.1.0";
export { formatTimecode } from "./timecode.js";
```

- [ ] **Step 7: Write the worker, its messages and the factory**

Create `packages/video-editor/src/workers/messages.ts`:
```ts
export interface PreviewWorkerPing {
	type: "ping";
	seconds: number;
}

export interface PreviewWorkerPong {
	type: "pong";
	timecode: string;
	/** True when the worker could import mediabunny, the first runtime dependency. */
	mediabunny: boolean;
}
```

Create `packages/video-editor/src/workers/preview-video.worker.ts`:
```ts
import { Input } from "mediabunny";
import { formatTimecode } from "../core/index.js";
import type { PreviewWorkerPing, PreviewWorkerPong } from "./messages.js";

// Spike worker: answers a ping with a formatted timecode. It imports a package
// module and a dependency on purpose, so the proof covers both resolutions
// from inside a worker that a host app bundles. The real preview-video worker
// replaces this body in step 1.
addEventListener("message", (event: MessageEvent<PreviewWorkerPing>) => {
	if (event.data?.type !== "ping") return;
	const reply: PreviewWorkerPong = {
		type: "pong",
		timecode: formatTimecode(event.data.seconds),
		mediabunny: typeof Input === "function",
	};
	postMessage(reply);
});
```

Create `packages/video-editor/src/workers/index.ts`:
```ts
/**
 * Spawns the preview worker. The URL points at the built .js beside this
 * module, which Vite rewrites into a worker chunk in dev and in builds.
 */
export function createPreviewWorker(): Worker {
	return new Worker(new URL("./preview-video.worker.js", import.meta.url), { type: "module" });
}

export type { PreviewWorkerPing, PreviewWorkerPong } from "./messages.js";
```

- [ ] **Step 8: Write the runtime probe, the component and the index**

Create `packages/video-editor/src/runtime-probe.ts`:
```ts
import { untrack } from "svelte";

/**
 * Hosts compare `runtimeProbe.untrack` with their own `untrack` import. Equal
 * references mean one Svelte runtime serves both the host and this package;
 * a second copy breaks reactivity and lifecycle calls silently.
 */
export const runtimeProbe = { untrack };
```

Create `packages/video-editor/src/ui/VideoEditor.svelte`:
```svelte
<!--
	Step 0 placeholder for the editor shell. It mounts, asks the preview
	worker for a timecode and shows the reply, so a host page can prove that
	the component, the worker and the token CSS all load from the package.
	The real editor replaces this in step 2.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { createPreviewWorker } from "../workers/index.js";
	import type { PreviewWorkerPong } from "../workers/messages.js";

	let { seconds = 83.5 }: { seconds?: number } = $props();
	let status = $state("waiting");

	onMount(() => {
		const worker = createPreviewWorker();
		worker.addEventListener("message", (event: MessageEvent<PreviewWorkerPong>) => {
			const { timecode, mediabunny } = event.data;
			status = `pong ${timecode} ${mediabunny ? "mediabunny" : "no-mediabunny"}`;
		});
		worker.addEventListener("error", (event) => {
			status = `error ${event.message}`;
		});
		worker.postMessage({ type: "ping", seconds });
		return () => worker.terminate();
	});
</script>

<div class="ve-shell" data-ve-status={status}>
	<p class="ve-title">Video editor spike</p>
	<p class="ve-status">{status}</p>
</div>

<style>
	.ve-shell {
		background: var(--ve-surface, #1e1e25);
		color: var(--ve-text, #f3f3f5);
		border: 1px solid var(--ve-stroke, rgba(255, 255, 255, 0.12));
		border-radius: var(--ve-radius, 12px);
		padding: 16px;
		font-family: var(--ve-font, system-ui, sans-serif);
	}
	.ve-title {
		margin: 0 0 4px;
		font-weight: 600;
	}
	.ve-status {
		margin: 0;
		color: var(--ve-text-dim, #9a9aa5);
		font-variant-numeric: tabular-nums;
	}
</style>
```

Create `packages/video-editor/src/index.ts`:
```ts
export { default as VideoEditor } from "./ui/VideoEditor.svelte";
export { createPreviewWorker } from "./workers/index.js";
export type { PreviewWorkerPing, PreviewWorkerPong } from "./workers/messages.js";
export { runtimeProbe } from "./runtime-probe.js";
export { VIDEO_EDITOR_VERSION, formatTimecode } from "./core/index.js";
```

- [ ] **Step 9: Confirm every file is LF and nothing else changed**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && git status --short && for f in $(git ls-files --others --exclude-standard packages/video-editor); do printf '%s %s\n' "$(tr -cd '\r' < "$f" | wc -c)" "$f"; done
```
Expected: only `?? packages/video-editor/` style entries, and a `0` before every file (no CR bytes).

---

### Task 3: Install, build, check, test, commit the package

**Files:**
- Modify: `pnpm-lock.yaml` (pnpm adds the `packages/video-editor` importer)

- [ ] **Step 1: Install the workspace in the worktree**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && pnpm install 2>&1 | tail -15
```
Expected: ends with `Done in Ns`. `git status --short` afterwards shows ` M pnpm-lock.yaml` plus the new package files; `node_modules/` and `packages/video-editor/node_modules/` are ignored.

- [ ] **Step 2: Build the package**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor build 2>&1 | tail -5 && ls packages/video-editor/dist packages/video-editor/dist/core packages/video-editor/dist/workers packages/video-editor/dist/ui
```
Expected: svelte-package reports the files it wrote; the listing shows `index.js`, `index.d.ts`, `runtime-probe.js`, `core/index.js`, `core/timecode.js`, `workers/index.js`, `workers/preview-video.worker.js`, `workers/messages.js`, `ui/VideoEditor.svelte`, `ui/VideoEditor.svelte.d.ts`.

- [ ] **Step 3: Check the worker kept its string URL and .js imports**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && grep -n 'new URL' dist/workers/index.js && grep -n '^import' dist/workers/preview-video.worker.js
```
Expected: `new URL("./preview-video.worker.js", import.meta.url)` and imports of `mediabunny` and `../core/index.js`.

- [ ] **Step 4: Run the core test**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor test 2>&1 | tail -8
```
Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: Run svelte-check and publint**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && pnpm --filter @austencloud/video-editor check 2>&1 | tail -3 && pnpm --filter @austencloud/video-editor exec publint 2>&1 | tail -5
```
Expected: `svelte-check found 0 errors and 0 warnings`; publint prints `All good!`. If publint complains that `svelte` points at a file missing from `files`, it is wrong about `dist` (built before publish); report the exact message instead of changing the exports map.

- [ ] **Step 6: Commit the package and the lockfile**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor pnpm-lock.yaml && git status --short && git commit -q -F - <<'MSG'
feat(video-editor): package skeleton with a module worker spike

Adds @austencloud/video-editor with a placeholder VideoEditor component,
the ./core entry (formatTimecode, VIDEO_EDITOR_VERSION), a preview worker
that imports a package module and mediabunny, the runtime probe for
duplicate-Svelte detection, and the --ve-* token stylesheet. Step 0 of the
extraction design.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```
Expected: the staged list contains only `packages/video-editor/...` and `pnpm-lock.yaml` (no `dist`, no `node_modules`), then the new commit line.

---

### Task 4: Headless proof scripts

Four small Node scripts under `packages/video-editor/scripts/spike/` (outside `files`, so never published). They drive a private headless Chrome through CDP with Node's built-in `fetch` and `WebSocket`, so no browser library is installed.

Amendment (2026-10-07, after review): the committed scripts (commits 114fbe5 and 6f6063b) supersede the listings below. The review added a port-in-use refusal, an ANSI-stripped `ready in N ms` match (Vite's "already in use" error contains "ready in"), a direct `node` spawn with no shell, DevToolsActivePort port discovery, worker auto-attach for console errors, a navigation and socket-close fail-fast, and a single-chunk-with-a-referencing-module assertion in worker-proof. Read the files, not the blocks, when a later step needs their behaviour.

**Files:**
- Create: `packages/video-editor/scripts/spike/cdp.mjs`
- Create: `packages/video-editor/scripts/spike/page-proof.mjs`
- Create: `packages/video-editor/scripts/spike/dev-proof.mjs`
- Create: `packages/video-editor/scripts/spike/worker-proof.mjs`

- [ ] **Step 1: Write the CDP helper**

Create `packages/video-editor/scripts/spike/cdp.mjs`:
```js
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
```

- [ ] **Step 2: Write the page proof**

Create `packages/video-editor/scripts/spike/page-proof.mjs`:
```js
import { pathToFileURL } from "node:url";
import { withHeadlessPage } from "./cdp.mjs";

export const EXPECTED_STATUS = "pong 1:23.500 mediabunny";

/**
 * Loads a spike page, waits for the VideoEditor worker reply and the
 * single-runtime flag, screenshots it, and prints a JSON summary followed by
 * PASS or FAIL. Console errors are printed for review but do not fail the
 * check on their own; a worker failure surfaces as an "error ..." status.
 */
export async function checkSpikePage(url, screenshotPath, timeoutMs = 180_000) {
	return withHeadlessPage(
		url,
		async (page) => {
			const status = await page.waitFor(
				`(() => { const s = document.querySelector("[data-ve-status]")?.dataset.veStatus ?? ""; return s.startsWith("pong") || s.startsWith("error") ? s : null; })()`,
				timeoutMs,
			);
			const singleSvelte = await page.evaluate(
				`document.querySelector("[data-ve-single-svelte]")?.dataset.veSingleSvelte ?? "missing"`,
			);
			if (screenshotPath) await page.screenshot(screenshotPath);
			const errors = page.consoleErrors();
			const ok = status === EXPECTED_STATUS && singleSvelte === "true";
			console.log(JSON.stringify({ url, status, singleSvelte, errors }, null, 2));
			console.log(ok ? "PASS" : "FAIL");
			return ok;
		},
		{ timeoutMs },
	);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [url, screenshotPath] = process.argv.slice(2);
	if (!url) {
		console.error("usage: node page-proof.mjs <url> [screenshot.png]");
		process.exit(2);
	}
	process.exitCode = (await checkSpikePage(url, screenshotPath)) ? 0 : 1;
}
```

- [ ] **Step 3: Write the dev-server proof**

Create `packages/video-editor/scripts/spike/dev-proof.mjs`:
```js
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
```

- [ ] **Step 4: Write the built-worker proof**

Create `packages/video-editor/scripts/spike/worker-proof.mjs`:
```js
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
```

- [ ] **Step 5: Self-test the page proof against a static page**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/spike/page-proof.mjs "data:text/html,%3Cbody%20data-ve-single-svelte%3Dtrue%3E%3Cdiv%20data-ve-status%3D%22pong%201%3A23.500%20mediabunny%22%3E%3C%2Fdiv%3E" "$TEMP/ve-selftest.png" && ls -la "$TEMP/ve-selftest.png"
```
Expected: a JSON summary with `"status": "pong 1:23.500 mediabunny"`, `"singleSvelte": "true"`, then `PASS`, and a PNG of a few KB. Afterwards `tasklist | grep -c chrome.exe` should not have grown compared with before the run (the helper killed its Chrome tree).

- [ ] **Step 6: Commit the scripts**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && git add packages/video-editor/scripts/spike && git commit -q -F - <<'MSG'
chore(video-editor): headless proof scripts for the packaging spike

cdp.mjs drives a private headless Chrome over CDP with Node's fetch and
WebSocket. page-proof.mjs checks a spike route, dev-proof.mjs wraps a dev
server start around it, and worker-proof.mjs serves a production client
build and runs the emitted preview worker chunk directly.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```

---

### Task 5: tka-platform wiring and dev-server proof

**Files (all under `E:/worktrees/tka-platform/video-editor/`):**
- Modify: `svelte.config.js` (kit.alias, the object that starts at the `// Core aliases` comment)
- Modify: `vite.config.ts` (`resolve.dedupe` near line 1053; `optimizeDeps.exclude` near line 1318)
- Create: `src/routes/test/video-editor-spike/+page.svelte`

Amendment (2026-10-07, after review): commit 0e3cbcab landed the steps below. The alias alone made svelte-check load a second copy of svelte's ambient types from the shared-packages worktree (5.49.1 beside tka's 5.49.2), which showed up as 41 new `Snippet` errors in untouched files. The fix is a `kit.typescript.config` hook in `svelte.config.js` that pins TypeScript's svelte to this app's copy. A bare `paths.svelte` entry is an exact match and would not cover `svelte/store` or `svelte/elements`, so the hook reads `node_modules/svelte/package.json` and writes one entry per export subpath with a `types` field (`"../node_modules/svelte/" + entry.types`, relative to `.svelte-kit/`), commit 812842e4. Vite is untouched; `resolve.dedupe` handles the runtime. The hook, its `node:fs` import and the aliases all go in step 4. Merge hold: the aliases are absolute `E:/` paths, so this branch stays unmerged until step 4 (CI on ubuntu would fail `check`).

- [ ] **Step 1: Add the aliases**

In `svelte.config.js`, inside `kit.alias`, insert these two entries before the `// Core aliases` comment. Order matters: SvelteKit emits Vite aliases in object order and Vite takes the first prefix match, so the `css` entry must come before the package entry.
```js
      // @austencloud/video-editor dev loop (extraction steps 0 to 3): resolve
      // the package from the shared-packages worktree's build output. Step 4
      // replaces these with the published dependency. The css entry sits
      // first because Vite takes the first matching alias prefix.
      "@austencloud/video-editor/css":
        "E:/worktrees/shared-packages/video-editor/packages/video-editor/css",
      "@austencloud/video-editor":
        "E:/worktrees/shared-packages/video-editor/packages/video-editor/dist",
```

- [ ] **Step 2: Dedupe svelte and mediabunny, exclude the package from pre-bundling**

In `vite.config.ts`, change the dedupe line:
```ts
    dedupe: ["three", "@threlte/core"],
```
to
```ts
    // svelte and mediabunny: @austencloud/video-editor ships .svelte files and
    // a worker that import both; one copy must serve the app and the package.
    dedupe: ["three", "@threlte/core", "svelte", "mediabunny"],
```
In `optimizeDeps.exclude`, after the `"@austencloud/camera-3d",` line add:
```ts
      // Ships .svelte files and a module worker that this app's Vite compiles.
      "@austencloud/video-editor",
```

- [ ] **Step 3: Create the spike route**

Create `src/routes/test/video-editor-spike/+page.svelte`:
```svelte
<!--
  Packaging spike for @austencloud/video-editor (extraction step 0). Renders
  the package's placeholder component, which asks its module worker for a
  timecode, and reports whether the page and the package share one Svelte
  runtime. The /test layout keeps this route out of production.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { VideoEditor, runtimeProbe } from "@austencloud/video-editor";
  import { formatTimecode } from "@austencloud/video-editor/core";
  import "@austencloud/video-editor/css/video-editor-tokens.css";

  const singleSvelte = runtimeProbe.untrack === untrack;
</script>

<main class="spike" data-ve-single-svelte={singleSvelte}>
  <h1>@austencloud/video-editor spike</h1>
  <p>Core says {formatTimecode(83.5)}. Single Svelte runtime: {singleSvelte}.</p>
  <VideoEditor seconds={83.5} />
</main>

<style>
  .spike {
    max-width: 640px;
    margin: 40px auto;
    padding: 0 16px;
    font-family: system-ui, sans-serif;
  }
</style>
```

- [ ] **Step 4: Sync SvelteKit and confirm the generated tsconfig paths**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && npx svelte-kit sync && grep -n 'video-editor' .svelte-kit/tsconfig.json
```
Expected: four `paths` entries: `@austencloud/video-editor/css`, `@austencloud/video-editor/css/*`, `@austencloud/video-editor`, `@austencloud/video-editor/*`, each pointing at `../../../shared-packages/video-editor/packages/video-editor/...`.

- [ ] **Step 5: Run the fast type gate and the route-guard test**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && npm run check:fast 2>&1 | tail -5 && npx vitest run --config tests/config/vitest.config.ts tests/unit/ssr-emptied-routes.test.ts 2>&1 | tail -6
```
Expected: check:fast reports 0 errors; the vitest file passes. If check:fast reports an error inside `@austencloud/video-editor` type declarations, report it with the message; do not add `// @ts-ignore`.

- [ ] **Step 6: Prove the dev server**

Confirm the port is free (`netstat -ano | grep ":5221 "` prints nothing), then run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/spike/dev-proof.mjs --url http://127.0.0.1:5221/test/video-editor-spike --shot "$TEMP/ve-tka-dev.png" --cwd E:/worktrees/tka-platform/video-editor -- node E:/worktrees/tka-platform/video-editor/node_modules/vite/bin/vite.js --port 5221 --strictPort --host 127.0.0.1 2>&1 | tail -40
```
Expected: `dev server root PID <n>`, Vite's ready lines, then the JSON summary with `"status": "pong 1:23.500 mediabunny"` and `"singleSvelte": "true"`, then `PASS`. The first start pre-bundles dependencies and can take a few minutes. Afterwards `netstat -ano | grep ":5221 "` shows no LISTENING line (the tree was killed).

If `singleSvelte` is `false`: dedupe did not take; report which `svelte` path the package resolved (search the page's network requests for `/@fs/E:/worktrees/shared-packages/` + `svelte`). If status is `error ...`: capture the message and the Vite terminal output in the report.

- [ ] **Step 7: Commit**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && git add svelte.config.js vite.config.ts src/routes/test/video-editor-spike/+page.svelte && git commit -q -F - <<'MSG'
chore(post): alias @austencloud/video-editor and add the packaging spike route

Resolves the package from the shared-packages worktree build output for the
extraction dev loop, dedupes svelte and mediabunny so the package shares the
app's copies, excludes it from pre-bundling, and adds /test/video-editor-spike,
which renders the placeholder component and its module worker.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```

---

### Task 6: tka-platform production build proof

**Files:** none edited. Build output lands in `E:/worktrees/tka-platform/video-editor/.svelte-kit/output/`.

Amendment (2026-10-07, after the run): `npm run build:all` fails on main for a reason unrelated to this work: the primary's installed `@austencloud/backgrounds` 0.7.12 lacks `setOceanFishSimulationSeed`, which `src/routes/test/ocean-character-lab/+page.svelte` imports, and `BUILD_ALL=true` keeps that route. The proof used the normal production build instead: a temporary, uncommitted copy of the spike page at `src/routes/video-editor-spike-proof/` (with a `+page.ts` exporting `ssr = false`), then `npm run build:packages && node scripts/svelte-kit-sync-if-needed.mjs && node scripts/generate-svg-precache-manifest.cjs` and `npx cross-env NODE_OPTIONS=--max-old-space-size=8192 NODE_ENV=production vite build` (not `npm run build`, whose chain ends in `upload-sourcemaps.js`). The build passed in 3m 46s and emitted `preview-video.worker-DGlyAZgN.js` (36 KB, referenced from node 345) beside tka's own 540 KB `preview-video.worker-CBHUuI3V.js` from `src/lib/shared/media-composition/workers/`, which step 1 moves into the package. worker-proof now picks the package chunk by its ping handler and passes against this output; the temporary route was deleted afterwards.

- [ ] **Step 1: Check the resource budget**

Run the two PowerShell probes from the ground rules. Proceed only with at least 4096 MB available and no other `svelte-check` process.

- [ ] **Step 2: Build with every route included**

`/test/*` pages are emptied from a normal production build; `build:all` sets `BUILD_ALL=true`, which keeps them, so the spike route and its worker import reach Rollup. Run:
```bash
cd /e/worktrees/tka-platform/video-editor && npm run build:all 2>&1 | tail -25
```
Expected: no error lines; the SvelteKit summary. This takes several minutes.

- [ ] **Step 3: Find the worker chunk**

Run:
```bash
cd /e/worktrees/tka-platform/video-editor && ls .svelte-kit/output/client/_app/immutable/workers/ | grep preview-video && grep -rl 'preview-video.worker' .svelte-kit/output/client/_app/immutable/nodes/ | head -3
```
Expected: `preview-video.worker-<hash>.js` and at least one route node that references it.

- [ ] **Step 4: Run the built worker**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/spike/worker-proof.mjs E:/worktrees/tka-platform/video-editor/.svelte-kit/output/client 18444
```
Expected: `worker chunk: preview-video.worker-<hash>.js`, then `worker reply: {"type":"pong","timecode":"1:23.500","mediabunny":true}` and `PASS`.

- [ ] **Step 5: Confirm nothing to commit**

Run `cd /e/worktrees/tka-platform/video-editor && git status --short`. Expected: empty (build output is ignored). If `packages/*/dist` or other generated files show up, report them rather than committing.

---

### Task 7: Ringmaster wiring and dev-server proof

**Files (all under `E:/worktrees/cirque-aflame/video-editor/`):**
- Modify: `ringmaster/svelte.config.js` (kit.alias)
- Modify: `ringmaster/vite.config.ts` (`resolve.dedupe`, `optimizeDeps.exclude`)
- Modify: `ringmaster/src/routes/+layout.svelte` (the `isLocalShowcase` list near line 83)
- Create: `ringmaster/src/routes/showcase/video-editor-spike/+page.svelte`
- Create (gitignored, never committed): `tmp/vite.worktree.config.mts`, `tmp/dev.mjs`

Ringmaster uses tabs for indentation.

Amendment (2026-10-07, after review): commits fed1c717, b503228f and 99cc7f67 landed the steps below plus three review fixes. (1) The same `kit.typescript.config` hook as tka (Task 5 amendment), with paths relative to `ringmaster/.svelte-kit/`, so `"../../node_modules/svelte/" + entry.types`; without it svelte-check gained 10 `Snippet` errors from a second svelte copy (5.43.6 here, 5.49.1 in the worktree). (2) `server.fs.allow` in the committed `ringmaster/vite.config.ts` adds `E:/worktrees/shared-packages/video-editor`: the worker file is reached through `new URL(..., import.meta.url)`, which Vite rewrites without marking it safe, so a launcher without that allow entry showed `error worker failed to load`. (3) `showcase/video-editor-spike/+page.ts` copies the `video-crop` dev guard (404 outside dev). Merge hold as in Task 5: the branch stays unmerged until step 4, because `gate.yml` and `deploy-ringmaster.yml` would fail on the absolute aliases.

- [ ] **Step 1: Add the aliases**

In `ringmaster/svelte.config.js`, inside `kit.alias`, insert before the `'@cirque/shared'` entry:
```js
			// @austencloud/video-editor dev loop (extraction steps 0 to 3): the
			// package resolves from the shared-packages worktree's build output
			// until step 4 pins the published version. The css entry sits first
			// because Vite takes the first matching alias prefix.
			'@austencloud/video-editor/css': 'E:/worktrees/shared-packages/video-editor/packages/video-editor/css',
			'@austencloud/video-editor': 'E:/worktrees/shared-packages/video-editor/packages/video-editor/dist',
```

- [ ] **Step 2: Dedupe and exclude**

In `ringmaster/vite.config.ts`, change
```ts
		dedupe: ['svelte']
```
to
```ts
		// mediabunny joins svelte: @austencloud/video-editor's worker imports it,
		// and one copy must serve the app and the package.
		dedupe: ['svelte', 'mediabunny']
```
and in `optimizeDeps.exclude`, after `'@austencloud/sidebar'` add a comma and:
```ts
			// Ships .svelte files and a module worker that this app's Vite compiles.
			'@austencloud/video-editor'
```

- [ ] **Step 3: Let the showcase page skip the login gate in dev**

In `ringmaster/src/routes/+layout.svelte`, in the `isLocalShowcase` derived expression, add after the `currentPath === '/showcase/video-crop' ||` line:
```ts
				currentPath === '/showcase/video-editor-spike' ||
```

- [ ] **Step 4: Create the spike page**

Create `ringmaster/src/routes/showcase/video-editor-spike/+page.svelte`:
```svelte
<!--
	DEV harness: packaging spike for @austencloud/video-editor (extraction
	step 0). Renders the package's placeholder component, which asks its module
	worker for a timecode, and reports whether the page and the package share
	one Svelte runtime. Step 3 replaces this with the real /studio routes.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { VideoEditor, runtimeProbe } from '@austencloud/video-editor';
	import { formatTimecode } from '@austencloud/video-editor/core';
	import '@austencloud/video-editor/css/video-editor-tokens.css';

	const singleSvelte = runtimeProbe.untrack === untrack;
</script>

<main class="spike" data-ve-single-svelte={singleSvelte}>
	<h1>@austencloud/video-editor spike</h1>
	<p>Core says {formatTimecode(83.5)}. Single Svelte runtime: {singleSvelte}.</p>
	<VideoEditor seconds={83.5} />
</main>

<style>
	.spike {
		max-width: 640px;
		margin: 40px auto;
		padding: 0 16px;
		color: var(--theme-text);
	}
	h1 {
		font-size: 1.25rem;
		margin: 0 0 8px;
	}
	p {
		color: var(--theme-text-dim);
		margin: 0 0 16px;
	}
</style>
```

- [ ] **Step 5: Sync SvelteKit, confirm paths, run check**

Run:
```bash
cd /e/worktrees/cirque-aflame/video-editor/ringmaster && npx svelte-kit sync && grep -n 'video-editor' .svelte-kit/tsconfig.json && npm run check 2>&1 | tail -4
```
Expected: the four `paths` entries, then `svelte-check found 0 errors and 0 warnings` (warnings that already exist on `main` are acceptable; errors are not).

- [ ] **Step 6: Write the worktree dev-server launcher (gitignored)**

`tmp/` is ignored by the repo's `.gitignore`. Create `tmp/vite.worktree.config.mts`:
```ts
import base from '../ringmaster/vite.config';
export default async (env: any) => {
	const resolved: any = typeof base === 'function' ? await (base as any)(env) : base;
	return {
		...resolved,
		cacheDir: 'E:/worktrees/cirque-aflame/video-editor/tmp/vite-cache',
		server: {
			...(resolved.server ?? {}),
			fs: {
				...(resolved.server?.fs ?? {}),
				allow: [
					...(resolved.server?.fs?.allow ?? []),
					'E:/cirque-aflame/node_modules',
					'E:/worktrees/cirque-aflame/video-editor',
					'E:/worktrees/shared-packages/video-editor'
				]
			}
		}
	};
};
```
Create `tmp/dev.mjs`:
```js
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['E:/cirque-aflame/node_modules/vite/bin/vite.js', 'dev', '--port', '5222', '--strictPort', '--config', '../tmp/vite.worktree.config.mts'], { cwd: 'E:/worktrees/cirque-aflame/video-editor/ringmaster', stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
```
Run `cd /e/worktrees/cirque-aflame/video-editor && git status --short tmp` and expect no output (ignored).

- [ ] **Step 7: Prove the dev server**

Confirm the port is free (`netstat -ano | grep ":5222 "` prints nothing), then run:
```bash
cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/spike/dev-proof.mjs --url http://localhost:5222/showcase/video-editor-spike --shot "$TEMP/ve-ringmaster-dev.png" --cwd E:/worktrees/cirque-aflame/video-editor/ringmaster -- node E:/cirque-aflame/node_modules/vite/bin/vite.js dev --port 5222 --strictPort --config ../tmp/vite.worktree.config.mts 2>&1 | tail -30
```
Expected: Vite's ready lines, the JSON summary with `"status": "pong 1:23.500 mediabunny"` and `"singleSvelte": "true"`, then `PASS`. If Vite prints `new dependencies optimized: mediabunny` and reloads once, the proof still passes because it polls. Afterwards `netstat -ano | grep ":5222 "` prints nothing.

- [ ] **Step 8: Commit**

Run:
```bash
cd /e/worktrees/cirque-aflame/video-editor && git add ringmaster/svelte.config.js ringmaster/vite.config.ts ringmaster/src/routes/+layout.svelte ringmaster/src/routes/showcase/video-editor-spike/+page.svelte && git status --short && git commit -q -F - <<'MSG'
chore(ringmaster): alias @austencloud/video-editor and add the packaging spike page

Resolves the package from the shared-packages worktree build output for the
extraction dev loop, dedupes mediabunny beside svelte, excludes the package
from pre-bundling, and adds /showcase/video-editor-spike, which renders the
placeholder component and its module worker without the login gate in dev.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```
Expected: the staged list holds exactly those four files.

---

### Task 8: Ringmaster production build proof and test suite

**Files:** none edited. Output in `E:/worktrees/cirque-aflame/video-editor/ringmaster/.svelte-kit/output/`.

- [ ] **Step 1: Check the resource budget**

Run the PowerShell probes from the ground rules.

- [ ] **Step 2: Build**

Run:
```bash
cd /e/worktrees/cirque-aflame/video-editor/ringmaster && npm run build 2>&1 | tail -20
```
Expected: no error lines; adapter-cloudflare's done message.

- [ ] **Step 3: Find and run the worker chunk**

Run:
```bash
cd /e/worktrees/cirque-aflame/video-editor/ringmaster && ls .svelte-kit/output/client/_app/immutable/workers/ | grep preview-video && cd /e/worktrees/shared-packages/video-editor/packages/video-editor && node scripts/spike/worker-proof.mjs E:/worktrees/cirque-aflame/video-editor/ringmaster/.svelte-kit/output/client 18445
```
Expected: the chunk name, then `worker reply: {"type":"pong","timecode":"1:23.500","mediabunny":true}` and `PASS`.

- [ ] **Step 4: Run the unit suite**

Run:
```bash
cd /e/worktrees/cirque-aflame/video-editor/ringmaster && npm test 2>&1 | tail -12
```
Expected: all test files pass; the summary has no `Errors` line (an `Errors` line means skipped files, see the vitest workers memory). Report any failure verbatim with the test name.

- [ ] **Step 5: Confirm nothing to commit**

Run `cd /e/worktrees/cirque-aflame/video-editor && git status --short`. Expected: empty.

---

### Task 9: Record the spike findings in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md` (the "Dev loop and publishing" section and the "Risks" section)

- [ ] **Step 1: Add a findings subsection**

Under `## Dev loop and publishing`, after the paragraph beginning `Step 4 replaces the alias`, add:
```markdown
### Step 0 findings (2026-10-07)

- Aliases live in `kit.alias` in each app's `svelte.config.js`, not in
  `vite.config.ts` or hand-written tsconfig `paths`: SvelteKit derives both
  the Vite alias list and the generated tsconfig `paths` from it. The
  `@austencloud/video-editor/css` entry precedes the package entry because
  Vite takes the first matching prefix.
- Both apps dedupe `mediabunny` beside `svelte`. The package's worker imports
  it, and without dedupe the aliased package resolved its own copy from the
  shared-packages worktree. tka runs mediabunny 1.44.2 and Ringmaster 1.61.0,
  so the package's `^1.44.0` range covers both.
- The worker chunk lands at `_app/immutable/workers/preview-video.worker-<hash>.js`
  in both production builds and runs from a static server with no app shell
  (`scripts/spike/worker-proof.mjs`).
- tka's `/test/*` routes are emptied from a normal production build;
  `npm run build:all` keeps them, which is how the spike route reached the
  tka build. Ringmaster's `/showcase/*` pages ship and sit behind the login
  gate in production.
- Proof scripts: `packages/video-editor/scripts/spike/` (cdp.mjs,
  page-proof.mjs, dev-proof.mjs, worker-proof.mjs). They are outside `files`
  and stay for steps 1 to 3.
```
Fill in any value that differed in practice (for example, if the chunk name pattern or a version differed, write what was observed).

- [ ] **Step 2: Mark the worker risk retired**

In `## Risks`, change the first bullet from
```markdown
- Workers from a package: unproven in this monorepo. Step 0 exists to retire
  this risk before anything moves.
```
to
```markdown
- Workers from a package: retired by step 0 on 2026-10-07 (dev servers and
  production builds of both apps run the packaged worker; see the Step 0
  findings above).
```

- [ ] **Step 3: Commit**

Run:
```bash
cd /e/worktrees/shared-packages/video-editor && git add docs/superpowers/specs/2026-10-07-video-editor-extraction-design.md && git commit -q -F - <<'MSG'
docs(video-editor): record the step 0 packaging spike findings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
git log --oneline -1
```

---

## Exit criteria (from the spec, step 0)

- The worker runs in both apps' dev servers: Task 5 step 6 and Task 7 step 7 print `PASS`.
- The worker runs in both apps' production builds: Task 6 step 4 and Task 8 step 3 print `PASS`.
- svelte-check resolves the subpaths: Task 5 step 5 and Task 7 step 5 report 0 errors with `@austencloud/video-editor` and `@austencloud/video-editor/core` imported.
- One Svelte runtime in each app: both page proofs report `"singleSvelte": "true"`.
- Merge hold: neither app branch merges or pushes before step 4 swaps the absolute `E:/` aliases for the published dependency; CI on ubuntu would fail on them.
