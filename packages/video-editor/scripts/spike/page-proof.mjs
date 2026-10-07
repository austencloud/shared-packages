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
