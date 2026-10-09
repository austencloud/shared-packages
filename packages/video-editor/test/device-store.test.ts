import { describe, expect, it } from "vitest";
import { createProjectSchema, normalizeProject } from "../src/core/index.js";
import { createDeviceStore } from "../src/store/device-store.js";
import { createHistoryStorage } from "../src/store/history-storage.js";
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

const scope = { ownerId: "owner-1", subjectId: "seq" };
const project = () => normalizeProject(createProjectSchema().parse(plain));
const device = () => {
	const local = new MemoryStorage();
	const session = new MemoryStorage();
	return {
		local,
		session,
		store: createDeviceStore({ local: () => local, session: () => session }),
	};
};

describe("device store with no plugin", () => {
	it("opens an empty project for the subject when nothing is saved", () => {
		const { store } = device();
		expect(store.openProject(scope, 5)).toMatchObject({
			subjectId: "seq",
			updatedAt: 5,
			takes: [],
		});
	});

	it("saves under the owner and subject, and opens the save again", () => {
		const { local, store } = device();
		expect(store.saveProject(scope, project())).toEqual({ ok: true });
		expect(local.getItem("video-editor:project:owner-1:seq")).toBe(JSON.stringify(project()));
		expect(store.openProject(scope, 9)).toEqual(project());
		expect(store.loadProject({ ownerId: "owner-2", subjectId: "seq" })).toBeNull();
	});

	it("keeps the save before as the spare copy", () => {
		const { local, store } = device();
		const first = project();
		store.saveProject(scope, first);
		store.saveProject(scope, { ...first, updatedAt: first.updatedAt + 1 });
		expect(local.getItem("video-editor:project:owner-1:seq:previous")).toBe(JSON.stringify(first));
	});

	it("refuses a save that belongs to another subject", () => {
		const { local, store } = device();
		local.setItem(
			"video-editor:project:owner-1:seq",
			JSON.stringify({ ...project(), subjectId: "other" }),
		);
		expect(store.loadProject(scope)).toBeNull();
	});

	it("asks the host's fallback before making an empty project", () => {
		const fallback = { ...project(), updatedAt: 42 };
		const local = new MemoryStorage();
		const store = createDeviceStore({
			local: () => local,
			session: () => null,
			openFallback: () => fallback,
		});
		expect(store.openProject(scope, 1)).toBe(fallback);
	});

	it("keeps the current project before an import, and says so when storage is missing", () => {
		const { local, store } = device();
		store.backupBeforeImport(scope, project());
		expect(local.getItem("video-editor:project:owner-1:seq:before-import")).toBe(
			JSON.stringify(project()),
		);
		const none = createDeviceStore({ local: () => null, session: () => null });
		expect(() => none.backupBeforeImport(scope, project())).toThrow(
			"Device storage is unavailable. The current post was kept.",
		);
		expect(none.saveProject(scope, project())).toEqual({
			ok: false,
			error: "Device storage is unavailable.",
		});
	});

	it("keeps undo history in the session store for the same save only", () => {
		const { session, store } = device();
		const head = project();
		const before = { ...head, updatedAt: head.updatedAt - 1 };
		store.saveHistory(scope, { head, past: [{ project: before }], future: [] });
		expect(session.getItem("video-editor:history:owner-1:seq")).not.toBeNull();
		expect(store.loadHistory(scope, head)).toEqual({ past: [{ project: before }], future: [] });
		expect(store.loadHistory(scope, { ...head, updatedAt: head.updatedAt + 1 })).toBeNull();
	});
});

describe("history storage", () => {
	it("names the subject field after the plugin's subject key, in today's position", () => {
		const session = new MemoryStorage();
		const history = createHistoryStorage<{ n: number }>({
			key: (subjectId) => `h:${subjectId}`,
			parseEffect: (value) =>
				value && typeof value === "object" && "n" in value ? (value as { n: number }) : undefined,
			storage: () => session,
		});
		const head = project();
		history.save({ head, past: [{ project: head, effect: { n: 1 } }], future: [] });
		expect(Object.keys(JSON.parse(session.getItem("h:seq")!))).toEqual([
			"version",
			"subjectId",
			"headUpdatedAt",
			"head",
			"headEffect",
			"past",
			"future",
		]);
		expect(history.load(head)?.past).toEqual([{ project: head, effect: { n: 1 } }]);
	});
});
