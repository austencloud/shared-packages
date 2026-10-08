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
	/** Normalize treats it as a visual a transition can join (today's isTransitionVisual). */
	transitionVisual?: boolean;
	/** Normalize placement: seconds of intro and lead-in before `start` (today's tunnelHook intro and lead). */
	placement?(item: PostItem): { intro: number; lead: number } | null;
	/** The kind's own intro keys win over generated region keys (today's "animation's intro keys are its own"). */
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
	/** The music URL check; core accepts any non-empty string. tka passes isFeatureVideoMediaUrl. */
	isMediaUrl?(url: unknown): url is string;
}
