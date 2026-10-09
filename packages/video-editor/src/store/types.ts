import type { PostProject } from "../core/project/item-kinds.js";

/** Who and what a store call is about. */
export interface StoreScope {
	/** host.ownerId when the call is made. */
	ownerId: string;
	/** The project's subject: the value of plugin.subjectKey (tka: sequenceId). */
	subjectId: string;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** One undo step. effect is what a plugin changed beside the project (tka: a take timing). */
export interface HistoryEntry<E = unknown> {
	project: PostProject;
	effect?: E;
}

export interface EditorHistory<E = unknown> {
	/** The saved project the history leads up to. */
	head: PostProject;
	headEffect?: E;
	past: readonly HistoryEntry<E>[];
	future: readonly HistoryEntry<E>[];
}

export interface RestoredEditorHistory<E = unknown> {
	headEffect?: E;
	past: HistoryEntry<E>[];
	future: HistoryEntry<E>[];
}

/** The PostEditorStore port with the owner passed in and timing left out. */
export interface VideoEditorStore<E = unknown> {
	/** The saved project for the scope, or a new empty one. */
	openProject(scope: StoreScope, now: number): PostProject;
	saveProject(scope: StoreScope, project: PostProject): SaveResult;
	/** Keeps the current project before an import replaces it. */
	backupBeforeImport(scope: StoreScope, project: PostProject): void;
	loadHistory(scope: StoreScope, head: PostProject): RestoredEditorHistory<E> | null;
	saveHistory(scope: StoreScope, history: EditorHistory<E>): void;
}
