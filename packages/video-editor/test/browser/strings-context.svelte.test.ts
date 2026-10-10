import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import StringsProbe from "./fixtures/StringsProbe.svelte";

describe("strings context", () => {
	it("reads the translate a parent provided", async () => {
		const screen = render(StringsProbe, { translate: (key) => "host:" + key });
		await expect.element(screen.getByTestId("text")).toHaveTextContent("host:editor_missing_video");
	});

	it("falls back to English with no provider", async () => {
		const screen = render(StringsProbe, {});
		await expect.element(screen.getByTestId("text")).toHaveTextContent("Missing video: a.mp4");
	});
});
