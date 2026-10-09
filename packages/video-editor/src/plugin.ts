import type { z } from "zod";
import type { CompileItemEnv, ProjectCompileHooks } from "./core/compile/hooks.js";
import type { EditContext } from "./core/edit/context.js";
import type { NewItemBase, NewOverlaySpec, PostItemPatch } from "./core/edit/project-edits.js";
import type { PostTake } from "./core/plan/post-plan.js";
import type { CoreItemKind, PostItem, PostProject } from "./core/project/item-kinds.js";
import type { PostBox } from "./core/project/schema.js";
import type { PainterFactory } from "./render/painter-registry.js";
import type { SurfaceCapture } from "./render/surfaces.js";

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
	 * DOM surfaces for the render modes the compositor cannot draw from media or
	 * a painter. A surface may hold state across the frames of one export; the
	 * exporter releases each when the export ends.
	 */
	surfaces?: readonly SurfaceCapture[];
	/**
	 * The music URL check; core accepts any non-empty string, and a host that allows only some
	 * URLs passes its own check.
	 */
	isMediaUrl?(url: unknown): url is string;
	/** The project field naming what a project is about. Default "subjectId"; tka "sequenceId". */
	subjectKey?: string;
	/** Plugin behaviour inside the edit engine. */
	editHooks?: EditHooks;
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
