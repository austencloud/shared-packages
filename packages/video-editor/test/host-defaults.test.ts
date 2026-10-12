import { afterEach, describe, expect, it, vi } from "vitest";
import { createWindowShortcuts, resolveServices } from "../src/host-defaults.js";

/** Dispatches a key as the page would get it; resolves to whether a listener claimed it. */
const press = (init: KeyboardEventInit, target: EventTarget = document.body) =>
	!target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

describe("default editor services", () => {
	it("says nothing outside dev and logs in dev", () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		resolveServices({ ownerId: "o" }).notify.success("saved");
		expect(info).not.toHaveBeenCalled();
		resolveServices({ ownerId: "o", dev: true }).notify.success("saved");
		expect(info).toHaveBeenCalledWith("saved");
		info.mockRestore();
	});

	it("keeps the services the host passes", () => {
		const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
		expect(resolveServices({ ownerId: "o", notify }).notify).toBe(notify);
	});

	it("plays original files and lists no library when the host passes neither", async () => {
		const services = resolveServices({ ownerId: "o" });
		const url = "https://example.test/take.mp4";
		const handle = services.previewCache.acquire(url);
		const state = {
			status: "fallback",
			sourceUrl: url,
			url,
			progress: 0,
			reason: "No preview cache",
		};
		expect(handle.getState()).toEqual(state);
		await expect(handle.ready).resolves.toEqual(state);
		const listener = vi.fn();
		handle.subscribe(listener)();
		handle.reportPlaybackError("decode");
		handle.release();
		expect(listener).not.toHaveBeenCalled();
		expect(services.mediaLibrary).toBeNull();
	});

	it("keeps the host's preview cache and media library", () => {
		const previewCache = { acquire: vi.fn() };
		const mediaLibrary = { listTakes: vi.fn(), resolveTake: vi.fn(), requestFor: vi.fn() };
		const services = resolveServices({ ownerId: "o", previewCache, mediaLibrary });
		expect(services.previewCache).toBe(previewCache);
		expect(services.mediaLibrary).toBe(mediaLibrary);
	});
});

describe("window shortcuts", () => {
	const shortcuts = createWindowShortcuts();
	let stops: (() => void)[] = [];
	afterEach(() => {
		for (const stop of stops) stop();
		stops = [];
		document.body.replaceChildren();
	});

	it("undoes on Ctrl+Z and redoes on Ctrl+Shift+Z and Ctrl+Y", () => {
		const undo = vi.fn();
		const redo = vi.fn();
		stops.push(
			shortcuts.editHistory(
				{ undo, redo, canUndo: () => true, canRedo: () => true },
				document.createElement("div"),
			),
		);
		press({ key: "z", ctrlKey: true });
		press({ key: "Z", ctrlKey: true, shiftKey: true });
		press({ key: "y", ctrlKey: true });
		expect(undo).toHaveBeenCalledTimes(1);
		expect(redo).toHaveBeenCalledTimes(2);
	});

	it("does nothing when there is nothing to undo, yet keeps the key from a page-wide undo", () => {
		const undo = vi.fn();
		// A host's own undo on the window that skips claimed keys (Ringmaster's tag history).
		const pageUndo = vi.fn();
		const onWindow = (event: KeyboardEvent) => {
			if (!event.defaultPrevented) pageUndo();
		};
		window.addEventListener("keydown", onWindow);
		stops.push(() => window.removeEventListener("keydown", onWindow));
		stops.push(
			shortcuts.editHistory(
				{ undo, redo: vi.fn(), canUndo: () => false, canRedo: () => false },
				document.createElement("div"),
			),
		);
		expect(press({ key: "z", ctrlKey: true })).toBe(true);
		expect(undo).not.toHaveBeenCalled();
		expect(pageUndo).not.toHaveBeenCalled();
		// Other chords pass through.
		expect(press({ key: "c", ctrlKey: true })).toBe(false);
	});

	it("leaves keys typed into a field alone", () => {
		const undo = vi.fn();
		stops.push(
			shortcuts.editHistory(
				{ undo, redo: vi.fn(), canUndo: () => true, canRedo: () => true },
				document.createElement("div"),
			),
		);
		const input = document.createElement("input");
		document.body.append(input);
		press({ key: "z", ctrlKey: true }, input);
		expect(undo).not.toHaveBeenCalled();
	});

	it("acts only while focus is in its editor or nowhere", () => {
		const undo = vi.fn();
		const section = document.createElement("section");
		section.setAttribute("data-edit-history-shortcut-scope", "");
		const anchor = document.createElement("span");
		const inside = document.createElement("button");
		const outside = document.createElement("button");
		section.append(anchor, inside);
		document.body.append(section, outside);
		stops.push(
			shortcuts.editHistory(
				{ undo, redo: vi.fn(), canUndo: () => true, canRedo: () => true },
				anchor,
			),
		);
		outside.focus();
		press({ key: "z", ctrlKey: true }, outside);
		expect(undo).not.toHaveBeenCalled();
		inside.focus();
		press({ key: "z", ctrlKey: true }, inside);
		expect(undo).toHaveBeenCalledTimes(1);
	});

	it("closes the topmost escape layer first", () => {
		const lower = vi.fn();
		const upper = vi.fn();
		stops.push(shortcuts.escapeLayer("lower", lower));
		const closeUpper = shortcuts.escapeLayer("upper", upper);
		press({ key: "Escape" });
		closeUpper();
		press({ key: "Escape" });
		expect(upper).toHaveBeenCalledTimes(1);
		expect(lower).toHaveBeenCalledTimes(1);
	});

	it("skips a key a suppressor claims", () => {
		const close = vi.fn();
		stops.push(shortcuts.escapeLayer("layer", close));
		stops.push(shortcuts.suppress((event) => event.key === "Escape"));
		press({ key: "Escape" });
		expect(close).not.toHaveBeenCalled();
	});

	it("stops listening when the last registration goes", () => {
		const remove = vi.spyOn(document, "removeEventListener");
		const off = shortcuts.escapeLayer("only", vi.fn());
		off();
		expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
		remove.mockRestore();
	});
});
