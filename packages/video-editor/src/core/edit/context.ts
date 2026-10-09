import type { VideoEditorPlugin } from "../../plugin.js";

export interface EditContext {
	now: number;
	/** The plugin whose kinds and fields the project carries. Required when the project has any. */
	plugin?: VideoEditorPlugin;
}
