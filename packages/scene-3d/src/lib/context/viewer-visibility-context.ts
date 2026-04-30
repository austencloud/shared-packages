import { getContext, setContext } from "svelte";

export interface ViewerVisibilityState {
	showProps: boolean;
	showGrid: boolean;
	showAvatar: boolean;
	showEffects: boolean;
	blueMotion: boolean;
	redMotion: boolean;
}

const KEY = Symbol("viewer-visibility");

export function setViewerVisibilityContext(state: ViewerVisibilityState): void {
	setContext(KEY, state);
}

export function getViewerVisibilityContext(): ViewerVisibilityState {
	const ctx = getContext<ViewerVisibilityState | undefined>(KEY);
	if (!ctx) {
		throw new Error(
			"Viewer visibility context missing - component must be rendered inside a visibility provider",
		);
	}
	return ctx;
}

export function tryGetViewerVisibilityContext(): ViewerVisibilityState | null {
	try {
		return getContext<ViewerVisibilityState | undefined>(KEY) ?? null;
	} catch {
		return null;
	}
}
