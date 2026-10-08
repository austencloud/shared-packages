/**
 * The package type-checks with one tsconfig and the DOM lib, so `self` is a
 * Window there and `postMessage(message, transfer)` does not type-check.
 * Workers use this instead of `self`. It reads `globalThis`, which is the
 * worker scope inside a worker and, unlike `self`, exists in Node and SSR, so
 * importing this module outside a worker does not throw.
 */
export interface WorkerScope {
	postMessage(message: unknown, transfer?: Transferable[]): void;
	addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
	onmessage: ((event: MessageEvent) => void) | null;
}

export const workerScope = globalThis as unknown as WorkerScope;
