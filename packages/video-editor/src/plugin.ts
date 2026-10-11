import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import type { Component, Snippet } from "svelte";
import type { z } from "zod";
import type { CompileItemEnv, ProjectCompileHooks } from "./core/compile/hooks.js";
import type { EditContext } from "./core/edit/context.js";
import type { NewItemBase, NewOverlaySpec, PostItemPatch } from "./core/edit/project-edits.js";
import type { PostTake } from "./core/plan/post-plan.js";
import type { MediaCompositionPreset } from "./core/preset/preset-schema.js";
import type { CoreItemKind, PostItem, PostProject } from "./core/project/item-kinds.js";
import type { PostBox } from "./core/project/schema.js";
import type { EvaluatedFrameLayer } from "./render/frame-evaluator.js";
import type { PostStudioLayerPainter } from "./render/layer-painter.js";
import type { PainterFactory } from "./render/painter-registry.js";
import type { SurfaceCapture } from "./render/surfaces.js";
import type { CompositionSourceBinding } from "./state/source-binding.js";
import type { VideoEditorState } from "./state/video-editor-state.svelte.js";
import type { Translate } from "./strings/translate.js";

export interface ShapeExtension {
	shape: z.ZodRawShape;
	/** Every key of the merged shape, in output order. */
	order?: readonly string[];
}

export interface ItemKindDefinition {
	kind: string;
	/** A z.object with `kind: z.literal(kind)`, built from the core's exported item base. */
	schema: z.ZodObject<z.ZodRawShape>;
	label: string;
	defaultBox(): PostBox;
	/** Normalize treats an item of this kind as a visual that a transition can join. */
	transitionVisual?: boolean;
	/**
	 * The seconds of intro and of lead-in an item carries before its `start`, or null for none;
	 * normalize places the item with them.
	 */
	placement?(item: PostItem): { intro: number; lead: number } | null;
	/**
	 * An item of this kind keeps the intro keys it carries; keys normalize generates for the
	 * region never replace them.
	 */
	ownsIntroKeys?: boolean;
	/**
	 * Adds the item's regions, keys, clips and roles through `env`, in the
	 * same order on every run (array order is part of the compiled preset),
	 * without changing the project. Returns false to skip the item: it draws
	 * nothing and does not extend the post's duration.
	 */
	compile(item: PostItem, env: CompileItemEnv): boolean;
	/**
	 * Builds a new item of this kind for addOverlayItem from the shared base and the Add spec.
	 * Absent: { ...base, kind }.
	 */
	create?: (base: NewItemBase, spec: NewOverlaySpec) => PostItem;
	/** The kind's editor UI; absent for a kind the core UI draws on its own. */
	ui?: ItemKindUi;
}

export interface VideoEditorPlugin {
	id: string;
	itemKinds: readonly ItemKindDefinition[];
	kindExtensions?: Partial<Record<CoreItemKind, ShapeExtension>>;
	projectExtension?: ShapeExtension;
	/**
	 * `before` sees the stored project, possibly an older shape, and `after`
	 * the laid-out one. Both run after every edit, must not mutate their
	 * input, and return it unchanged when they change nothing.
	 */
	normalize?: {
		before?(project: PostProject): PostProject;
		after?(project: PostProject): PostProject;
	};
	/**
	 * The compiler's hooks around the core kinds. They push regions, keys,
	 * clips and roles in the same order on every run (array order is part of
	 * the compiled preset) and never change the project.
	 */
	compileHooks?: ProjectCompileHooks;
	/**
	 * Extra compile outputs: each factory returns the empty array that
	 * `env.addOutput` pushes onto, set on the result after `texts` in this key
	 * order. Each factory returns a new empty array on every call; a shared
	 * array would pile up entries across compiles and change the compiled
	 * output from the second compile on. A name that is also a core output key
	 * throws.
	 */
	compileOutputs?: Readonly<Record<string, () => unknown>>;
	/**
	 * Painters for the plugin's painted roles, asked in order after the core
	 * factories; a factory returns null for a role that is not its own.
	 */
	painters?: readonly PainterFactory[];
	/**
	 * DOM surfaces for the render modes the compositor cannot draw from media or a painter.
	 * Called once per render (an export or a still); the exporter releases each surface when that
	 * render ends, so per-render caches live inside one call and never cross renders.
	 */
	createSurfaces?(): readonly SurfaceCapture[];
	/**
	 * The music URL check; core accepts any non-empty string, and a host that allows only some
	 * URLs passes its own check.
	 */
	isMediaUrl?(url: unknown): url is string;
	/** The project field naming what a project is about. Default "subjectId"; tka "sequenceId". */
	subjectKey?: string;
	/** Plugin behaviour inside the edit engine. */
	editHooks?: EditHooks;
	/** The plugin's editor UI. A missing member renders nothing. */
	ui?: PluginUi;
}

export interface EditHooks {
	/** A take points at other media; return the project with plugin data that follows the take. Runs before finish. */
	takeMediaChanged?: (
		project: PostProject,
		change: TakeMediaChange,
		ctx: EditContext,
	) => PostProject;
	/** Applies the plugin's patch fields to next, a copy of item, after the core fields. next is updateItem's `{ ...item } as Record<string, unknown>`. */
	patchItem?: (item: PostItem, next: Record<string, unknown>, patch: PostItemPatch) => void;
}

export type TakeMediaChange =
	| {
			kind: "replace";
			takeId: string;
			offsetSeconds: number;
			takeKey: string;
			durationSeconds: number;
	  }
	| {
			kind: "relink";
			takeId: string;
			ref: PostTake["ref"];
			takeKey: string;
			durationSeconds: number;
	  };

/** What every plugin tool panel receives. `editor` is the generic state; a plugin that needs its own members reads them from its own context. */
export interface ToolPanelProps {
	editor: VideoEditorState;
	/** The selected item, or null when the tool belongs to no item (the empty selection row). */
	item: PostItem | null;
	/** The active tool id. */
	tool: string;
	locked: boolean;
	/** Whether an appearance panel fills its parent; the side placement passes true. */
	appearanceFill?: boolean;
}

/** A part of an item that the timeline draws as its own block and the canvas selects on its own (tka: an animation's opening tunnel). */
export interface ItemPart {
	id: string;
	/** Seconds in post time, or null when the item has no such part now. */
	span(item: PostItem): { start: number; end: number } | null;
	label(t: (key: string) => string): string;
	icon: IconDefinition;
}

export interface ItemKindUi {
	/** Icon on timeline blocks, the add panel and the tool row; `iconFor` lets a mode pick its own (tka: a mandala). */
	icon: IconDefinition;
	iconFor?(item: PostItem): IconDefinition;
	/** The translated kind name; without it the editor shows the definition's `label`. */
	label?(t: (key: string) => string, item: PostItem | null): string;
	/** The kind's own tool panels; renders nothing for a tool it does not own. */
	toolPanel?: Component<ToolPanelProps>;
	parts?: readonly ItemPart[];
}

/** A tool a plugin adds to the tool row. A panel tool opens its panel; an action tool runs. */
export type PluginTool =
	| { id: string; type: "panel"; label(t: (key: string) => string): string; icon: IconDefinition }
	| {
			id: string;
			type: "action";
			label(t: (key: string) => string): string;
			icon: IconDefinition;
			/** False disables the tool's button (tka: Beats needs a clip with footage). Absent: always enabled. */
			enabled?(editor: VideoEditorState): boolean;
			run(editor: VideoEditorState, context?: ToolRunContext): void;
	  };

/** What an action tool's `run` gets when something other than the tool row runs it. */
export interface ToolRunContext {
	/** The library take a panel's row ran the tool for (tka: Tap beats on a video row). */
	takeId?: string;
}

/** An entry the plugin adds to the add panel. */
export interface PluginAddItem {
	id: string;
	label(t: (key: string) => string): string;
	icon: IconDefinition;
	/** False hides the entry (tka: the tunnel hook when the post already has one). */
	available(editor: VideoEditorState): boolean;
	/** Runs after the panel pauses playback. Returns the kind it added (the panel then opens that kind's tools, as for a core add), or null. */
	add(editor: VideoEditorState): string | null;
}

export interface MediaSublayerProps {
	editor: VideoEditorState;
	binding: CompositionSourceBinding;
	layer: EvaluatedFrameLayer;
	role: string;
	regionId: string;
	preset: MediaCompositionPreset | null;
	/** The item the layer draws, and the item under it when the layer is an overlay of a main item. */
	sourceItem: PostItem | null;
	underlyingItem: PostItem | null;
	playing: boolean;
	exporting: boolean;
}

export interface CanvasOverlayProps {
	editor: VideoEditorState;
	/** True while the crop screen owns the canvas; an overlay hides itself. */
	cropping: boolean;
}

/** A screen state the plugin owns (tka: the timing mode). Each slot replaces the edit mode's slot while the mode is active. */
export interface EditorMode {
	id: string;
	/** The dock's content while the mode is active; the settings drawer it may open also shows the save status. */
	dock?: Component<{ editor: VideoEditorState; draftStatus: Snippet }>;
	panel?: Component<{ editor: VideoEditorState }>;
	stage?: Component<{ editor: VideoEditorState }>;
	timeline?: Component<{ editor: VideoEditorState }>;
	/** The bar above the stage while the mode is active (tka: Back, the take picker, the save status). It replaces the top bar slot and owns the mode's own undo keys; `draftStatus` is the workspace's save-status snippet. */
	toolbar?: Component<{ editor: VideoEditorState; draftStatus: Snippet }>;
	/** Keys while the mode is active; return true when handled. */
	keydown?(event: KeyboardEvent, editor: VideoEditorState): boolean;
}

/** Source bindings and painters for the plugin's roles, made once per editor. */
export interface PluginBindings {
	bindingFor(role: string): CompositionSourceBinding | null;
	exportPainters(): ReadonlyMap<string, PostStudioLayerPainter>;
	/**
	 * Whether the plugin's sources can render now, and why not when one failed (tka: the changed
	 * notation and the animation overlay are prepared, and the viewer's panels are still). Read
	 * inside a `$derived`, so what it reads is tracked. Absent: always ready.
	 */
	renderStatus?(): { ready: boolean; error: string | null };
	/**
	 * Readies what the plugin redraws before a render, which waits for it and fails with it (tka:
	 * both looks of every image). Absent: nothing to ready.
	 */
	prepareRender?(): Promise<void>;
	/**
	 * A notice the top bar shows beside Undo and Redo; `alert` marks a failure (tka: the changed
	 * notation is being prepared, or could not be). Read inside a `$derived`. Absent: none.
	 */
	notice?(): { message: string; alert: boolean } | null;
	/**
	 * True while the host shows the editor's stage elsewhere, so a hidden editor keeps playing
	 * (tka: the sequence viewer holds the shared surfaces). Read inside an `$effect`, so what it
	 * reads is tracked. Absent: a hidden editor always pauses.
	 */
	stageHeldElsewhere?(): boolean;
	dispose(): void;
}

export interface PluginUi {
	/** Panels for plugin tools on core kinds, and additions after a core tool's own panel. */
	toolPanel?: Component<ToolPanelProps>;
	tools?: readonly PluginTool[];
	/** The tool row for a selection, given the core row; return the row in display order. The editor answers what the row depends on (tka: the selected part, a QR image, a backdrop). */
	toolRow?(
		selection: PostItem | null,
		coreRow: readonly string[],
		editor: VideoEditorState,
	): readonly string[];
	addItems?(coreItems: readonly string[]): readonly (string | PluginAddItem)[];
	mediaSublayer?: { renderModes: readonly string[]; component: Component<MediaSublayerProps> };
	/**
	 * Redraws a generic image layer's picture in a look of the plugin's (tka: a QR image in its own
	 * look or the poster look of the card under it). `look` runs inside a `$derived`, so what it reads
	 * is tracked; null keeps the imported picture. `render` resolves the redrawn picture's URL; null or
	 * a rejection keeps the imported picture.
	 */
	imageRestyle?: {
		look(env: {
			editor: VideoEditorState;
			sourceItem: PostItem | null;
			underlyingItem: PostItem | null;
		}): string | null;
		render(source: string, look: string): Promise<string | null>;
	};
	/**
	 * Called on a right click on any media layer, with the editor the layer draws for (as a tool's
	 * `run(editor)` gets it); the editor prevents the default when present.
	 */
	layerContextMenu?(event: MouseEvent, editor: VideoEditorState): void;
	canvasOverlays?: readonly Component<CanvasOverlayProps>[];
	modes?: readonly EditorMode[];
	/** Whole panels keyed by a plugin tool id (tka: the "look" animation panel). */
	panels?: Readonly<Record<string, Component<{ editor: VideoEditorState }>>>;
	/**
	 * Made once per editor during the workspace's initialisation, so it may call getContext. `previewUrl` is the
	 * workspace's preview resolver: the URL a take plays from (its preview copy when ready, else `url`).
	 */
	createBindings?(env: {
		editor: VideoEditorState;
		t: Translate;
		previewUrl(takeId: string, url: string | null): string | null;
	}): PluginBindings;
	/** Crop screen landing marks for a video item (tka: the tapped placements). */
	cropSteps?(editor: VideoEditorState, itemId: string): readonly ClipStep[];
	/** Two items the timeline draws joined (tka: the animation handing over to the moves square). */
	timelineJoin?(project: PostProject): TimelineJoin | null;
	backup?: PluginBackup;
	/** What the project is about, for the editor's label (tka: the sequence's name or its derived word). Absent: the default name string. */
	subjectName?(editor: VideoEditorState): string | null;
	/** The export file's stem (tka: the simplified word). Absent: the subject name, else "video". */
	exportFileStem?(editor: VideoEditorState): string | null;
}

/** The top bar's Backup, Restore and Import entries (tka: its JSON backup and the InShot recovery package). Absent: the workspace shows none of them. */
export interface PluginBackup {
	/** What the hidden file picker accepts for Restore and Import. */
	accept: string;
	/** The file Backup downloads for the project as it stands. */
	serialize(editor: VideoEditorState): { blob: Blob; filename: string };
	/**
	 * Reads the files the user picked. Resolves with the project and its media to import, or null when the
	 * files are the open project's own media to relink; rejects with the message to show.
	 */
	importFiles(
		editor: VideoEditorState,
		files: readonly File[],
	): Promise<{ project: PostProject; files: Map<string, File> } | null>;
}

/** A landing mark on the crop screen's clip timeline. */
export interface ClipStep {
	/** Post seconds. */
	seconds: number;
	/** Arrival position: 0 is the opening, p the landing of step p. */
	position: number;
	/** The plugin's own index for the step; null for the opening. */
	stepIndex: number | null;
	/** The label the crop timeline shows. */
	label: string;
	/** The first step of a pass. */
	passStart: boolean;
}

/** Two items the timeline draws as one block on the first item's row, joined from start to end. */
export interface TimelineJoin {
	fromId: string;
	toId: string;
	fromTrackIndex: number;
	toTrackIndex: number;
	/** Post seconds where the first becomes the second. */
	start: number;
	end: number;
}
