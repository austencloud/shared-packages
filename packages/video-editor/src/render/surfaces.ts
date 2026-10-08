import type { LayoutRegion } from "../core/preset/layout-schema.js";
import type { MediaCompositionPreset } from "../core/preset/preset-schema.js";
import type { EvaluatedFrameLayer } from "./frame-evaluator.js";
import type { PixelRect } from "./media-fit.js";

/**
 * One layer the compositor hands a surface. The context is already turned with
 * the layer's region, clipped to its rounded rect and at the layer's opacity;
 * the compositor restores it after `draw`. The surface resolves its own
 * geometry, because a capture's size is known only once it is taken.
 */
export interface SurfaceDrawInput {
	context: CanvasRenderingContext2D;
	/** The `.media-layer` element the preview mounted for this layer's clip. */
	layerElement: HTMLElement;
	layer: EvaluatedFrameLayer;
	preset: MediaCompositionPreset;
	/** The layer's region where it sits at this frame. */
	region: LayoutRegion;
	/** That region in output pixels. */
	regionPixels: PixelRect;
	/** Canvases kept across the frames of one render, owned by the caller. */
	cache: Map<string, HTMLCanvasElement>;
}

/**
 * Draws a layer the compositor cannot read from media or a painter: a surface
 * the host's preview renders as live DOM, captured into the output.
 */
export interface SurfaceCapture {
	/** The `data-render-mode` this surface draws. */
	renderMode: string;
	draw(input: SurfaceDrawInput): Promise<void>;
	/** Frees what the surface holds across frames. The exporter calls it when the export ends. */
	release?(): void;
}
