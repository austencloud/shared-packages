import type { Component } from "svelte";
import { describe, expect, it, vi } from "vitest";
import { faFan } from "../src/ui/kit/icons.js";
import type {
	ItemKindUi,
	PluginBindings,
	PluginUi,
	ToolPanelProps,
	VideoEditorPlugin,
} from "../src/plugin.js";

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

	it("restyle an image through the plugin's look and render", async () => {
		const look = vi.fn(
			(env: { sourceItem: { id: string } | null; underlyingItem: { id: string } | null }) =>
				env.underlyingItem ? "dark" : null,
		);
		const render = vi.fn((source: string, chosen: string) =>
			Promise.resolve(`${source}#${chosen}`),
		);
		const ui: PluginUi = { imageRestyle: { look, render } };
		const restyle = ui.imageRestyle;
		const env = {
			editor: {} as never,
			sourceItem: { id: "qr" } as never,
			underlyingItem: { id: "card" } as never,
		};
		expect(restyle?.look(env)).toBe("dark");
		expect(look).toHaveBeenCalledWith(env);
		expect(restyle?.look({ ...env, underlyingItem: null })).toBeNull();
		await expect(restyle?.render("blob:qr", "dark")).resolves.toBe("blob:qr#dark");
		expect(render).toHaveBeenCalledWith("blob:qr", "dark");
	});

	it("bindings report render readiness and a notice, and ready their sources", async () => {
		const prepared: string[] = [];
		const bindings: PluginBindings = {
			bindingFor: () => null,
			exportPainters: () => new Map(),
			renderStatus: () => ({ ready: false, error: "Not prepared" }),
			prepareRender: async () => {
				prepared.push("looks");
			},
			notice: () => ({ message: "Preparing", alert: false }),
			dispose: () => {},
		};
		expect(bindings.renderStatus?.()).toEqual({ ready: false, error: "Not prepared" });
		expect(bindings.notice?.()).toEqual({ message: "Preparing", alert: false });
		await bindings.prepareRender?.();
		expect(prepared).toEqual(["looks"]);
	});

	it("bindings say when the stage plays elsewhere", () => {
		let held = false;
		const bindings: PluginBindings = {
			bindingFor: () => null,
			exportPainters: () => new Map(),
			stageHeldElsewhere: () => held,
			dispose: () => {},
		};
		expect(bindings.stageHeldElsewhere?.()).toBe(false);
		held = true;
		expect(bindings.stageHeldElsewhere?.()).toBe(true);
		const plain: PluginBindings = {
			bindingFor: () => null,
			exportPainters: () => new Map(),
			dispose: () => {},
		};
		expect(plain.stageHeldElsewhere?.()).toBeUndefined();
	});

	it("bindings report a take's status and the export panel's extra steps", () => {
		const bindings: PluginBindings = {
			bindingFor: () => null,
			exportPainters: () => new Map(),
			takeStatus: (takeId) => (takeId === "a" ? { id: "stale", text: "Sequence changed" } : null),
			exportTodos: () => [{ key: "a", text: "Check timing for A", takeId: "a" }],
			dispose: () => {},
		};
		expect(bindings.takeStatus?.("a")).toEqual({ id: "stale", text: "Sequence changed" });
		expect(bindings.takeStatus?.("b")).toBeNull();
		expect(bindings.exportTodos?.()).toEqual([
			{ key: "a", text: "Check timing for A", takeId: "a" },
		]);
		const plain: PluginBindings = {
			bindingFor: () => null,
			exportPainters: () => new Map(),
			dispose: () => {},
		};
		expect(plain.takeStatus?.("a")).toBeUndefined();
		expect(plain.exportTodos?.()).toBeUndefined();
	});
});
