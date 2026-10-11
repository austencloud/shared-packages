import { getContext, setContext } from "svelte";
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type { VideoEditorState } from "../state/video-editor-state.svelte.js";
import { resolveServices, type EditorServices } from "../host-defaults.js";

export interface EditorUi<E = unknown> {
	readonly editor: VideoEditorState<E>;
	readonly host: VideoEditorHost<E>;
	readonly plugin: VideoEditorPlugin | null;
	readonly services: EditorServices;
}

const EDITOR_UI = Symbol("video-editor-ui");

export function provideEditorUi<E>(ui: EditorUi<E>): EditorUi<E> {
	setContext(EDITOR_UI, ui);
	return ui;
}

/** True when an ancestor (<VideoEditor>) already provided the editor context. */
export function hasEditorUi(): boolean {
	return getContext<EditorUi | undefined>(EDITOR_UI) !== undefined;
}

export function useEditorUi<E = unknown>(): EditorUi<E> {
	const ui = getContext<EditorUi<E> | undefined>(EDITOR_UI);
	if (!ui) throw new Error("useEditorUi() runs inside <VideoEditor>.");
	return ui;
}

/** The editor's services, or the package defaults outside an editor (a kit component in a test). */
export function useEditorServices(): EditorServices {
	return getContext<EditorUi | undefined>(EDITOR_UI)?.services ?? resolveServices({ ownerId: "" });
}
