import type { PostProject } from "../core/project/item-kinds.js";

/** A new post has no media to protect until it contains a take or an item. */
export function isEmptyProject(project: PostProject): boolean {
	return project.takes.length === 0 && project.tracks.every((track) => track.items.length === 0);
}

export function shouldSubmitDraft(project: PostProject, revision: number): boolean {
	return revision > 0 || !isEmptyProject(project);
}

/** Serialize writes so an older request cannot finish after the newest edit. */
export function createDraftAutosave(
	save: (project: PostProject) => Promise<void>,
	onStatus: (saving: boolean, error: string | null) => void,
) {
	let queued: PostProject | null = null;
	let latest: PostProject | null = null;
	let running = false;
	let disposed = false;

	async function drain(): Promise<void> {
		if (running) return;
		running = true;
		while (queued) {
			const project = queued;
			queued = null;
			let error: string | null = null;
			try {
				await save(project);
			} catch (cause) {
				error = cause instanceof Error ? cause.message : "Could not save the disk backup.";
			}
			if (!queued && !disposed) onStatus(false, error);
		}
		running = false;
	}

	function submit(project: PostProject): void {
		latest = project;
		queued = project;
		if (!disposed) onStatus(true, null);
		void drain();
	}

	return {
		submit,
		retry: () => {
			if (latest) submit(latest);
		},
		dispose: () => {
			disposed = true;
		},
	};
}
