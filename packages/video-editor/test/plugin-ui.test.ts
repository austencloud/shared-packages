import type { Component } from "svelte";
import { describe, expect, it } from "vitest";
import { faFan } from "../src/ui/kit/icons.js";
import type { ItemKindUi, PluginUi, ToolPanelProps, VideoEditorPlugin } from "../src/plugin.js";

const Panel = (() => {}) as unknown as Component<ToolPanelProps>;

describe("plugin UI members", () => {
	it("are component values and plain functions on the plugin and its kinds", () => {
		const kindUi: ItemKindUi = {
			icon: faFan,
			toolPanel: Panel,
			parts: [
				{ id: "opening", span: () => ({ start: 0, end: 1 }), label: (t) => t("x"), icon: faFan },
			],
		};
		const ui: PluginUi = {
			toolPanel: Panel,
			tools: [{ id: "look", type: "panel", label: (t) => t("look"), icon: faFan }],
			toolRow: (_selection, core) => [...core, "look"],
			modes: [{ id: "timing" }],
		};
		const plugin: VideoEditorPlugin = { id: "probe", itemKinds: [], ui };
		expect(plugin.ui?.toolRow?.(null, ["trim"], {} as never)).toEqual(["trim", "look"]);
		expect(kindUi.parts?.[0]?.span({} as never)).toEqual({ start: 0, end: 1 });
	});
});
