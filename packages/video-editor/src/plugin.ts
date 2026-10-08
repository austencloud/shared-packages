import type { z } from "zod";
import type { CoreItemKind, PostItem, PostProject } from "./core/project/item-kinds.js";
import type { PostBox } from "./core/project/schema.js";

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
	/** The seconds of intro and of lead-in an item carries before its `start`, or null for none; normalize places the item with them. */
	placement?(item: PostItem): { intro: number; lead: number } | null;
	/** An item of this kind keeps the intro keys it carries; keys normalize generates for the region never replace them. */
	ownsIntroKeys?: boolean;
}

export interface VideoEditorPlugin {
	id: string;
	itemKinds: readonly ItemKindDefinition[];
	kindExtensions?: Partial<Record<CoreItemKind, ShapeExtension>>;
	projectExtension?: ShapeExtension;
	normalize?: {
		before?(project: PostProject): PostProject;
		after?(project: PostProject): PostProject;
	};
	/** The music URL check; core accepts any non-empty string, and a host that allows only some URLs passes its own check. */
	isMediaUrl?(url: unknown): url is string;
}
