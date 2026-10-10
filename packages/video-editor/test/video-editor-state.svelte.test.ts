import { describe, expect, it, vi } from "vitest";
import { createProjectSchema, normalizeProject, updateItem } from "../src/core/index.js";
import type { VideoEditorHost } from "../src/host.js";
import {
	createVideoEditorState,
	type StateExtension,
} from "../src/state/video-editor-state.svelte.js";
import { createDeviceStore } from "../src/store/device-store.js";
import type { PostProject } from "../src/core/project/item-kinds.js";
import plain from "./fixtures/plain.project.json";

class MemoryStorage implements Storage {
	#items = new Map<string, string>();
	get length(): number {
		return this.#items.size;
	}
	clear(): void {
		this.#items.clear();
	}
	getItem(key: string): string | null {
		return this.#items.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.#items.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.#items.delete(key);
	}
	setItem(key: string, value: string): void {
		this.#items.set(key, String(value));
	}
}

const KEY = "video-editor:project:owner-1:seq";
const saved = () => normalizeProject(createProjectSchema().parse(plain));
const textOf = (project: PostProject) =>
	project.tracks.flatMap((track) => track.items).find((item) => item.kind === "text");

let clock = 10_000;
function hostWith<E = unknown>(
	local: MemoryStorage,
	extra: Partial<VideoEditorHost<E>> = {},
): VideoEditorHost<E> {
	return {
		ownerId: "owner-1",
		store: createDeviceStore<E>({ local: () => local, session: () => new MemoryStorage() }),
		now: () => ++clock,
		...extra,
	};
}
function seeded(): MemoryStorage {
	const local = new MemoryStorage();
	local.setItem(KEY, JSON.stringify(saved()));
	return local;
}

describe("video editor state with no plugin", () => {
	it("starts an empty project for the subject when nothing is saved", () => {
		const state = createVideoEditorState(hostWith(new MemoryStorage()), undefined, {
			subjectId: "seq",
		});
		expect(state.subjectId).toBe("seq");
		expect(state.project).toMatchObject({ subjectId: "seq", takes: [] });
		state.dispose();
	});

	it("opens, edits, undoes, redoes, saves and reopens", () => {
		const local = seeded();
		const state = createVideoEditorState(hostWith(local), undefined, { subjectId: "seq" });
		expect(state.project).toEqual(saved());
		const id = textOf(state.project)!.id;

		expect(state.edit((project, ctx) => updateItem(project, id, { text: "Hi" }, ctx))).toBe(true);
		expect(textOf(state.project)).toMatchObject({ text: "Hi" });
		expect(state.saveError).toBeNull();
		expect(textOf(JSON.parse(local.getItem(KEY)!))).toMatchObject({ text: "Hi" });

		state.undo();
		expect(textOf(state.project)).toEqual(textOf(saved()));
		state.redo();
		expect(textOf(state.project)).toMatchObject({ text: "Hi" });
		state.dispose();

		const reopened = createVideoEditorState(hostWith(local), undefined, { subjectId: "seq" });
		expect(textOf(reopened.project)).toMatchObject({ text: "Hi" });
		reopened.dispose();
	});

	it("gives every edit the context with no plugin", () => {
		const state = createVideoEditorState(hostWith(seeded()), undefined, { subjectId: "seq" });
		expect(state.editContext()).toEqual({ now: expect.any(Number) });
		state.dispose();
	});

	it("reports a failed save in the host's words", () => {
		const local = seeded();
		const base = createDeviceStore({ local: () => local, session: () => new MemoryStorage() });
		const state = createVideoEditorState(
			hostWith(local, {
				store: { ...base, saveProject: () => ({ ok: false, error: "full" }) },
				translate: (key, params) => `${key}:${String(params?.error)}`,
			}),
			undefined,
			{ subjectId: "seq" },
		);
		const id = textOf(state.project)!.id;
		state.edit((project, ctx) => updateItem(project, id, { text: "Hi" }, ctx));
		expect(state.saveError).toBe("editor_save_failed:full");
		state.dispose();
	});

	it("starts in the edit mode and keeps a plugin mode's id", () => {
		const editor = createVideoEditorState(hostWith(seeded()), undefined, { subjectId: "seq" });
		expect(editor.mode).toBe("edit");
		editor.mode = "timing";
		expect(editor.mode).toBe("timing");
		editor.dispose();
	});

	it("selects a part of an item and drops the part when any item is selected", () => {
		const editor = createVideoEditorState(hostWith(seeded()), undefined, { subjectId: "seq" });
		const [first, second] = editor.project.tracks.flatMap((track) => track.items);
		if (!first || !second) throw new Error("the plain fixture has two items");
		editor.selectPart(first.id, "opening");
		expect(editor.selectedItemId).toBe(first.id);
		expect(editor.selectedPart).toBe("opening");
		editor.selectedItemId = second.id;
		expect(editor.selectedPart).toBeNull();
		editor.dispose();
	});

	it("drops the part when its item is deleted", () => {
		const editor = createVideoEditorState(hostWith(seeded()), undefined, { subjectId: "seq" });
		const item = textOf(editor.project)!;
		editor.selectPart(item.id, "opening");
		expect(editor.selectedPart).toBe("opening");
		expect(editor.deleteSelected()).toBe(true);
		expect(editor.selectedItemId).toBeNull();
		expect(editor.selectedPart).toBeNull();
		editor.dispose();
	});
});

describe("state extension", () => {
	it("is built once with the state and hears selection, effects, attached media and dispose", () => {
		const hooks = {
			embed: vi.fn((project: PostProject) => project),
			takeAttached: vi.fn(),
			takeWithoutMedia: vi.fn(),
			selected: vi.fn(),
			replayEffect: vi.fn(),
			dispose: vi.fn(),
		} satisfies StateExtension<{ n: number }>;
		const extension = vi.fn(() => hooks);
		const state = createVideoEditorState<{ n: number }>(hostWith(seeded()), undefined, {
			subjectId: "seq",
			extension,
		});
		expect(extension).toHaveBeenCalledOnce();
		expect(extension).toHaveBeenCalledWith(state);
		expect(hooks.takeAttached.mock.calls.length + hooks.takeWithoutMedia.mock.calls.length).toBe(
			saved().takes.length,
		);

		const id = textOf(state.project)!.id;
		state.selectedItemId = id;
		expect(hooks.selected).toHaveBeenLastCalledWith(id);

		const next = updateItem(state.project, id, { text: "Effect" }, state.editContext());
		expect(state.commit(next, { n: 1 })).toBe(true);
		state.undo();
		expect(hooks.replayEffect).toHaveBeenCalledWith({ n: 1 }, "undo");

		state.dispose();
		expect(hooks.dispose).toHaveBeenCalledOnce();
	});
});
