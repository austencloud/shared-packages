import type { PostProject } from "../core/project/item-kinds.js";
import { normalizeProject } from "../core/project/normalize.js";
import { createProjectSchema } from "../core/project/schema-factory.js";
import { subjectKeyOf, subjectOf } from "../core/project/subject.js";
import { deepEqual } from "../core/deep-equal.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type { EditorHistory, HistoryEntry, RestoredEditorHistory } from "./types.js";

/**
 * Keeps each project's recent undo history in this tab, so Undo still works
 * after the page reloads, whether from a refresh or the dev server. It lives
 * in sessionStorage: a reload keeps it, closing the tab ends it, and other
 * tabs never see it.
 *
 * A history only applies to the exact save it leads up to: same saved time,
 * same content. When the project that opens is a different save, such as a
 * newer draft from the disk archive or another tab, the history is dropped.
 * Undo must never step back into a project that was not the one on screen.
 *
 * Every read and write is guarded: when storage is full or blocked, the
 * history is simply not kept, and editing carries on.
 */

const FORMAT_VERSION = 1;
/** How many steps back, and forward, survive a reload. */
const PERSISTED_DEPTH = 50;
/** Most one project's history may take, in characters; the oldest steps go first. */
const CHARACTER_BUDGET = 1_500_000;

export interface HistoryStorageOptions<E = unknown> {
	plugin?: VideoEditorPlugin;
	/** Ends with the subject id; key("") is the family prefix whose other histories give way when storage is full. */
	key: (subjectId: string) => string;
	/**
	 * Validates a stored effect. Absent: stored effects are dropped. A stored effect it rejects
	 * (returns undefined for) voids the whole history.
	 */
	parseEffect?: (value: unknown) => E | undefined;
	/** Project fields the history ignores when it compares a saved head (tka: ["timings"]). */
	volatileFields?: readonly string[];
	/** Default: guarded sessionStorage. */
	storage?: () => Storage | null;
}

function guardedSessionStorage(): Storage | null {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		return null;
	}
}

function forget(store: Storage, key: string): void {
	try {
		store.removeItem(key);
	} catch {
		// Blocked storage has nothing to forget.
	}
}

/**
 * Writes the history; when the tab is full, other projects' histories under
 * the same prefix go first. Histories under another prefix are left alone.
 */
function write(store: Storage, prefix: string, key: string, text: string): void {
	try {
		store.setItem(key, text);
		return;
	} catch {
		// Full or blocked; try once more with room made below.
	}
	try {
		const others: string[] = [];
		for (let index = 0; index < store.length; index += 1) {
			const other = store.key(index);
			if (other?.startsWith(prefix) && other !== key) others.push(other);
		}
		for (const other of others) store.removeItem(other);
		store.setItem(key, text);
	} catch {
		// An older history would no longer lead to the saved project.
		forget(store, key);
	}
}

/** Marks a stored effect the host rejected; one such step voids the whole history. */
const UNREADABLE = Symbol("unreadable effect");

export function createHistoryStorage<E = unknown>(
	options: HistoryStorageOptions<E>,
): {
	load(head: PostProject): RestoredEditorHistory<E> | null;
	save(history: EditorHistory<E>): void;
} {
	const { plugin, key: keyFor, parseEffect } = options;
	const storage = options.storage ?? guardedSessionStorage;
	const subjectKey = subjectKeyOf(plugin);
	const volatileFields = options.volatileFields ?? [];
	let schema: ReturnType<typeof createProjectSchema> | null = null;
	const projectSchema = () => (schema ??= createProjectSchema(plugin));

	/**
	 * The project as the history saw it. Volatile fields are left out: a host
	 * may rebuild them on load (tka rebuilds each take's timing from the newest
	 * map), so they can differ without the project itself changing.
	 */
	function headContent(project: PostProject): PostProject {
		const content: Record<string, unknown> = { ...project };
		for (const field of volatileFields) content[field] = undefined;
		return content as unknown as PostProject;
	}

	/** A stored non-null effect: dropped with no parseEffect, else parsed or UNREADABLE. */
	function readEffect(value: unknown): E | undefined | typeof UNREADABLE {
		if (!parseEffect) return undefined;
		const parsed = parseEffect(value);
		return parsed === undefined ? UNREADABLE : parsed;
	}

	function parseEntry(value: unknown, subject: string): HistoryEntry<E> | null {
		if (!value || typeof value !== "object") return null;
		const { project, effect } = value as Record<string, unknown>;
		const parsed = projectSchema().safeParse(project);
		if (!parsed.success || subjectOf(parsed.data, plugin) !== subject) return null;
		const entry: HistoryEntry<E> = { project: normalizeProject(parsed.data, plugin) };
		if (effect === undefined || effect === null) return entry;
		const parsedEffect = readEffect(effect);
		if (parsedEffect === UNREADABLE) return null;
		return parsedEffect === undefined ? entry : { ...entry, effect: parsedEffect };
	}

	function parseHistory(
		value: unknown,
		head: PostProject,
		subject: string,
	): RestoredEditorHistory<E> | null {
		if (!value || typeof value !== "object") return null;
		const saved = value as Record<string, unknown>;
		if (
			saved.version !== FORMAT_VERSION ||
			saved[subjectKey] !== subject ||
			saved.headUpdatedAt !== head.updatedAt ||
			!Array.isArray(saved.past) ||
			!Array.isArray(saved.future)
		)
			return null;
		const savedHead = projectSchema().safeParse(saved.head);
		if (!savedHead.success || !deepEqual(headContent(savedHead.data), headContent(head)))
			return null;
		let headEffect: E | undefined;
		if (saved.headEffect !== null && saved.headEffect !== undefined) {
			const parsed = readEffect(saved.headEffect);
			if (parsed === UNREADABLE) return null;
			headEffect = parsed;
		}
		// One unreadable step would make Undo skip a state, so it voids the lot.
		const past: HistoryEntry<E>[] = [];
		for (const entry of saved.past) {
			const parsed = parseEntry(entry, subject);
			if (!parsed) return null;
			past.push(parsed);
		}
		const future: HistoryEntry<E>[] = [];
		for (const entry of saved.future) {
			const parsed = parseEntry(entry, subject);
			if (!parsed) return null;
			future.push(parsed);
		}
		return { ...(headEffect !== undefined ? { headEffect } : {}), past, future };
	}

	return {
		save(history) {
			const store = storage();
			if (!store) return;
			const subject = subjectOf(history.head, plugin);
			// A project with no subject has no key to keep its history under.
			if (subject === undefined) return;
			const key = keyFor(subject);
			try {
				const past = history.past.slice(-PERSISTED_DEPTH).map((entry) => JSON.stringify(entry));
				const future = history.future.slice(-PERSISTED_DEPTH).map((entry) => JSON.stringify(entry));
				// The subject sits second, under the plugin's subject key (tka: sequenceId).
				const envelope = JSON.stringify({
					version: FORMAT_VERSION,
					[subjectKey]: subject,
					headUpdatedAt: history.head.updatedAt,
					head: headContent(history.head),
					headEffect: history.headEffect ?? null,
				});
				let size =
					envelope.length +
					[...past, ...future].reduce((total, text) => total + text.length + 1, 0);
				// Past ends with the newest step and future with the next redo, so the
				// front of each list is the step furthest from what is on screen.
				while (size > CHARACTER_BUDGET && past.length > 0) size -= past.shift()!.length + 1;
				while (size > CHARACTER_BUDGET && future.length > 0) size -= future.shift()!.length + 1;
				if (past.length === 0 && future.length === 0) {
					forget(store, key);
					return;
				}
				// The steps are already JSON; splice them in rather than encode twice.
				write(
					store,
					keyFor(""),
					key,
					`${envelope.slice(0, -1)},"past":[${past.join(",")}],"future":[${future.join(",")}]}`,
				);
			} catch {
				forget(store, key);
			}
		},

		/**
		 * The history kept for this project, when it leads up to exactly this save.
		 * Any other history for the project is stale and is cleared.
		 */
		load(head) {
			const store = storage();
			if (!store) return null;
			const subject = subjectOf(head, plugin);
			if (subject === undefined) return null;
			const key = keyFor(subject);
			try {
				const raw = store.getItem(key);
				if (!raw) return null;
				const restored = parseHistory(JSON.parse(raw) as unknown, head, subject);
				if (!restored) forget(store, key);
				return restored;
			} catch {
				forget(store, key);
				return null;
			}
		},
	};
}
