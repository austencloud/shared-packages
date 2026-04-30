import { getContext, setContext } from "svelte";

const KEY = Symbol("viewer-3d");

export function setViewer3DContext<T>(state: T): void {
	setContext(KEY, state);
}

export function getViewer3DContext<T>(): T {
	return getContext<T>(KEY);
}

export function tryGetViewer3DContext<T>(): T | null {
	try {
		return getContext<T>(KEY);
	} catch {
		return null;
	}
}
