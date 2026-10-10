import type { MediaSourceKind } from "../core/preset/source-schema.js";
import type { PostStudioRenderMode } from "../core/plan/presets.js";
import type { PostStudioLayerPainter } from "../render/layer-painter.js";

export type CompositionSourceStatus = "ready" | "preparing" | "missing";

/** One media layer's source as the editor canvas binds it. */
export interface CompositionSourceBinding {
	roleKey: string;
	kind: MediaSourceKind;
	label: string;
	previewUrl: string | null;
	previewType?: "video" | "image";
	renderMode?: PostStudioRenderMode;
	/** Draws a `painted` source; preview and export call the same one. */
	painter?: PostStudioLayerPainter;
	durationSeconds?: number;
	/** Original dimensions remain authoritative when a smaller playback copy is used. */
	sourceWidth?: number;
	sourceHeight?: number;
	onPreviewError?: () => void;
	hasAudio?: boolean;
	status: CompositionSourceStatus;
	missingMessage?: string;
	/** The canvas draws this source without its crop chrome while the crop screen is open (tka: staff roles). */
	readonly bareWhileCropping?: boolean;
}
