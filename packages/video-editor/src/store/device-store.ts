import type { PostProject } from "../core/project/item-kinds.js";
import { normalizeProject } from "../core/project/normalize.js";
import { createEmptyPostProject } from "../core/project/schema.js";
import { createProjectSchema } from "../core/project/schema-factory.js";
import { subjectKeyOf, subjectOf } from "../core/project/subject.js";
import type { VideoEditorPlugin } from "../plugin.js";
import { createHistoryStorage } from "./history-storage.js";
import type { SaveResult, StoreScope, VideoEditorStore } from "./types.js";

/**
 * Saves a project on this device, under keys the host names. The owner comes
 * in with every call (StoreScope.ownerId), so the store reads no sign-in
 * state of its own. Cloud persistence, when a host has it, runs after this
 * local save.
 */

export interface DeviceStoreKeys {
	project(scope: StoreScope): string;
	/** The spare copy of the save before the current one. */
	previous(scope: StoreScope): string;
	beforeImport(scope: StoreScope): string;
	/** sessionStorage key of the undo history. */
	history(scope: StoreScope): string;
	/** Spare copies, which give way when storage is full. */
	isSpareCopy(key: string): boolean;
}

export interface DeviceStoreOptions<E = unknown> {
	plugin?: VideoEditorPlugin;
	/** Default: deviceStoreKeys("video-editor:"). */
	keys?: DeviceStoreKeys;
	/**
	 * When nothing is saved: a host migration (tka: a v1 plan). null falls through to an empty
	 * project. That built-in empty project carries only the subject key, so a host whose
	 * `projectExtension` has other required fields passes a fallback that always returns a
	 * project. tka's does (a migrated v1 plan, else its own empty post), so the built-in default
	 * never runs there.
	 */
	openFallback?: (scope: StoreScope, now: number) => PostProject | null;
	/** Validates a stored history effect. Default: effects are dropped. */
	parseEffect?: (value: unknown) => E | undefined;
	/** Project fields the history ignores when it compares a saved head (tka: ["timings"]). */
	volatileFields?: readonly string[];
	/** Test seams. Default: guarded localStorage and sessionStorage. */
	local?: () => Storage | null;
	session?: () => Storage | null;
}

export interface DeviceStore<E = unknown> extends VideoEditorStore<E> {
	/** The saved project, parsed, subject-checked and normalized, or null. */
	loadProject(scope: StoreScope): PostProject | null;
}

/** Plain keys for a host with no legacy format: <prefix>project:<owner>:<subject> and so on. */
export function deviceStoreKeys(prefix: string): DeviceStoreKeys {
	const project = (scope: StoreScope) => `${prefix}project:${scope.ownerId}:${scope.subjectId}`;
	return {
		project,
		previous: (scope) => `${project(scope)}:previous`,
		beforeImport: (scope) => `${project(scope)}:before-import`,
		history: (scope) => `${prefix}history:${scope.ownerId}:${scope.subjectId}`,
		isSpareCopy: (key) => key.startsWith(prefix) && key.endsWith(":previous"),
	};
}

function guardedLocalStorage(): Storage | null {
	try {
		return typeof localStorage === "undefined" ? null : localStorage;
	} catch {
		return null;
	}
}

export function createDeviceStore<E = unknown>(
	options: DeviceStoreOptions<E> = {},
): DeviceStore<E> {
	const { plugin, openFallback, parseEffect, volatileFields, session } = options;
	const keys = options.keys ?? deviceStoreKeys("video-editor:");
	const storage = options.local ?? guardedLocalStorage;
	const schema = createProjectSchema(plugin);

	function dropSpareCopies(store: Storage, keep: string): void {
		const spare = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
			(key): key is string => !!key && key !== keep && keys.isSpareCopy(key),
		);
		for (const key of spare) store.removeItem(key);
	}

	function loadProject(scope: StoreScope): PostProject | null {
		const store = storage();
		if (!store) return null;
		try {
			const raw = store.getItem(keys.project(scope));
			if (!raw) return null;
			const parsed = schema.safeParse(JSON.parse(raw));
			if (!parsed.success || subjectOf(parsed.data, plugin) !== scope.subjectId) return null;
			// A project saved before an edit that changes how normalizing works (or
			// one written by hand for a test) may not already be laid out; every
			// reader gets the current rules applied rather than stale positions.
			return normalizeProject(parsed.data, plugin);
		} catch {
			return null;
		}
	}

	/** The undo history for the scope's owner, in the session store. */
	const historyFor = (scope: StoreScope) =>
		createHistoryStorage<E>({
			...(plugin ? { plugin } : {}),
			key: (subjectId) => keys.history({ ownerId: scope.ownerId, subjectId }),
			...(session ? { storage: session } : {}),
			...(parseEffect ? { parseEffect } : {}),
			...(volatileFields ? { volatileFields } : {}),
		});

	return {
		loadProject,

		/**
		 * Saves the project on this device. The project itself always comes first:
		 * when storage is full, the spare copies of earlier saves give way to it,
		 * and the spare copy of this project is kept only when it still fits.
		 */
		saveProject(scope: StoreScope, project: PostProject): SaveResult {
			const store = storage();
			if (!store) return { ok: false, error: "Device storage is unavailable." };
			try {
				const key = keys.project(scope);
				const spareKey = keys.previous(scope);
				const next = JSON.stringify(project);
				const previous = store.getItem(key);
				try {
					store.setItem(key, next);
				} catch {
					dropSpareCopies(store, spareKey);
					store.removeItem(spareKey);
					store.setItem(key, next);
				}
				if (previous !== null && previous !== next) {
					try {
						store.setItem(spareKey, previous);
					} catch {
						// No room for a spare copy; the project itself is saved.
						store.removeItem(spareKey);
					}
				}
				if (store.getItem(key) !== next) {
					return {
						ok: false,
						error: "The post could not be verified in device storage.",
					};
				}
				return { ok: true };
			} catch (cause) {
				return {
					ok: false,
					error:
						cause &&
						typeof cause === "object" &&
						"message" in cause &&
						typeof cause.message === "string"
							? cause.message
							: "The post could not be saved on this device.",
				};
			}
		},

		/** Keep the previous edit recoverable across reloads when importing a draft. */
		backupBeforeImport(scope: StoreScope, project: PostProject): void {
			const store = storage();
			if (!store) throw new Error("Device storage is unavailable. The current post was kept.");
			store.setItem(keys.beforeImport(scope), JSON.stringify(project));
		},

		/** The saved project, else the host's fallback, else an empty project for the subject. */
		openProject(scope: StoreScope, now: number): PostProject {
			return (
				loadProject(scope) ??
				openFallback?.(scope, now) ??
				createEmptyPostProject({ now }, { [subjectKeyOf(plugin)]: scope.subjectId })
			);
		},

		loadHistory(scope, head) {
			return historyFor(scope).load(head);
		},

		saveHistory(scope, history) {
			historyFor(scope).save(history);
		},
	};
}
