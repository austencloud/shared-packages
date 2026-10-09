import { describe, expect, it } from "vitest";
import { englishString, formatString, translatorFor } from "../src/strings/translate.js";

describe("strings", () => {
	it("fills named placeholders and leaves unknown ones", () => {
		expect(formatString("Missing video: {name}", { name: "a.mp4" })).toBe("Missing video: a.mp4");
		expect(formatString("{a} and {b}", { a: 1 })).toBe("1 and {b}");
	});

	it("does not rescan an inserted value", () => {
		expect(formatString("Missing video: {name}", { name: "{error}.mp4" })).toBe(
			"Missing video: {error}.mp4",
		);
	});

	it("falls back to English when the host has no translate", () => {
		expect(translatorFor({})("editor_save_failed", { error: "full" })).toBe(
			"The project could not be saved: full",
		);
		expect(englishString("editor_default_take")).toBe("Take");
	});

	it("uses the host's translate when it has one", () => {
		const translate = translatorFor({ translate: (key) => `<${key}>` });
		expect(translate("editor_missing_image", { name: "x" })).toBe("<editor_missing_image>");
	});
});
