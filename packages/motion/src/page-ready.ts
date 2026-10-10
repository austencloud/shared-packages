/**
 * Lets a page that is still reading its data ask the page transition to wait.
 * The transition keeps the old page frozen on screen while it waits, so the
 * clicked card holds still, then morphs into real content instead of a
 * placeholder. The wait is capped so a slow read never stalls a click.
 */
export const PAGE_READY_CAP_MS = 300;

const holds = new Set<symbol>();
let waiters: Array<() => void> = [];

function settle(): void {
	if (holds.size) return;
	const ready = waiters;
	waiters = [];
	for (const resolve of ready) resolve();
}

/** Call while a page shows a placeholder. The returned release is safe to call more than once. */
export function holdPageReady(): () => void {
	const token = Symbol('page-ready');
	holds.add(token);
	return () => {
		if (!holds.delete(token)) return;
		settle();
	};
}

/** Resolves when no page holds, or after the cap. */
export function waitForPageReady(capMs = PAGE_READY_CAP_MS): Promise<void> {
	if (!holds.size) return Promise.resolve();
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			waiters = waiters.filter((waiter) => waiter !== done);
			resolve();
		};
		const timer = setTimeout(done, capMs);
		waiters.push(done);
	});
}
