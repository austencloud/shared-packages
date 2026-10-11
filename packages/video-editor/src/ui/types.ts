import type { PostProject } from "../core/project/item-kinds.js";
import type { VideoEditorHost } from "../host.js";
import type { VideoEditorPlugin } from "../plugin.js";
import type {
	VideoEditorState,
	VideoEditorStateOptions,
} from "../state/video-editor-state.svelte.js";
import type { PostStudioShareExport } from "./share-export.js";

export type { PostStudioShareExport as ShareExport } from "./share-export.js";

export interface VideoEditorProps<E = unknown> {
	host: VideoEditorHost<E>;
	/** Absent for a plugin-free host (Ringmaster): every generic panel renders, no plugin member is asked. */
	plugin?: VideoEditorPlugin;
	/**
	 * A state the host built (tka passes its wrapper, which forwards the package state and adds the
	 * timing and tunnel members its plugin UI reads). Without it the component builds one with
	 * createVideoEditorState(host, plugin, stateOptions) and disposes it on destroy; a passed state is
	 * the host's to dispose.
	 */
	editor?: VideoEditorState<E>;
	/** Options for the state the component builds; default `{ subjectId: "default" }` (2A's `options` is required). */
	stateOptions?: VideoEditorStateOptions<E>;
	/** False while mounted but hidden: playback pauses and shortcuts stop. Default true. */
	active?: boolean;
	/** While set, the preview stage is reparented into this element (tka's sequence viewer). */
	previewTarget?: HTMLElement | null;
	/** While set, the inspector panel is reparented into this element. */
	inspectorTarget?: HTMLElement | null;
	/** True while the host's share sheet owns the screen. */
	sharing?: boolean;
	onSaveDraft?: (project: PostProject) => Promise<PostProject | null | void>;
	draftLoadError?: string | null;
	onExported?: (blob: Blob) => void;
	onSharePost?: () => void;
	/** The editor hands the host its export controls; the return value unregisters them. */
	registerExport?: (controls: PostStudioShareExport) => () => void;
	/** The project's opening audio choice when it has none yet. */
	audioSeed?: "takes" | "silent" | null;
	onAudioChange?: (audio: "takes" | "silent", chosen: boolean) => void;
}
