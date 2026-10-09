// Step 3 proof for Task 14, run by the controller: loads a tka dev page in a
// private headless Chrome (the in-app browser pane stalls requestAnimationFrame
// while hidden, which freezes tka's boot splash), waits for tka to boot, and on
// the trail export parity page presses Run parity and waits for the verdict the
// harness mirrors to window.__trailParityResult.
//
// usage: node trail-parity-proof.mjs <url> <screenshot.png> [run]
import { withHeadlessPage } from "./cdp.mjs";

const [url, shot, mode, expect] = process.argv.slice(2);
if (!url || !shot) {
  console.error(
    "usage: node trail-parity-proof.mjs <url> <screenshot.png> [run]",
  );
  process.exit(2);
}

const EXPECT = expect ?? "";
const BOOTED =
  "(() => { const EXPECT = " +
  JSON.stringify(EXPECT) +
  ";  const t = document.body.innerText || ''; const splash = document.getElementById('app-loading'); return !t.includes('Starting up') && !t.includes('Checking session') && !t.includes('Connecting to cloud') && (!splash || splash.classList.contains('loaded')) && t.trim().length > 40 && (!EXPECT || t.includes(EXPECT)) ? t.slice(0, 1200) : null; })()";

try {
  const out = await withHeadlessPage(
    url,
    async ({ evaluate, waitFor, screenshot, consoleErrors }) => {
      const booted = await waitFor(BOOTED, 120_000);
      console.log("booted; page text:\n" + booted + "\n");
      let verdict = null;
      let result = null;
      if (mode === "run") {
        const clicked = await evaluate(
          "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Run parity'); if (!b) return 'no button'; b.click(); return 'clicked'; })()",
        );
        console.log("run parity:", clicked);
        if (clicked !== "clicked")
          throw new Error("Run parity button not found");
        result = await waitFor(
          "(() => { const r = window.__trailParityResult; return r ? JSON.stringify(r) : null; })()",
          300_000,
        );
        verdict = await evaluate(
          "(() => { const t = document.body.innerText || ''; const i = t.search(/\\b(PASS|FAIL)\\b(?! requires)/); return i >= 0 ? t.slice(Math.max(0, i - 200), i + 600) : null; })()",
        );
      }
      await screenshot(shot);
      return { verdict, result, errors: consoleErrors() };
    },
    { timeoutMs: 120_000 },
  );
  if (out.result) console.log("result:", out.result.slice(0, 2000));
  if (out.verdict) console.log("verdict text:\n" + out.verdict);
  console.log("console errors:", JSON.stringify(out.errors, null, 1));
  console.log("screenshot:", shot);
  if (mode === "run") {
    const ok =
      out.result?.includes('"verdict":"PASS"') ||
      /\bPASS\b(?! requires)/.test(out.verdict ?? "");
    console.log(ok ? "PARITY PASS" : "PARITY FAIL");
    process.exitCode = ok ? 0 : 1;
  }
} catch (error) {
  console.error("proof failed:", error.message);
  process.exitCode = 1;
}
