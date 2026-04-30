import { getContext, setContext } from "svelte";

export interface SceneFeatureState {
	reportProgress(feature: string, progress: number): void;
	reportReady(feature: string): void;
	isReady(feature: string): boolean;
	isEnabled(feature: string): boolean;
}

const KEY = Symbol("scene-features");

export function setSceneFeatureContext(state: SceneFeatureState): void {
	setContext(KEY, state);
}

export function getSceneFeatureContext(): SceneFeatureState | null {
	try {
		return getContext<SceneFeatureState>(KEY) ?? null;
	} catch {
		return null;
	}
}
