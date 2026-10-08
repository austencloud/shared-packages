import { z } from "zod";
import type { VideoEditorPlugin } from "../../plugin.js";
import { createPostMusicSchema, isNonEmptyString } from "../music/post-music.js";
import type { PostProject } from "./item-kinds.js";
import {
	CORE_ITEM_SHAPES,
	CORE_PROJECT_SHAPE,
	CORE_TRACK_SHAPE,
	refineUniqueIds,
} from "./schema.js";

/** Joins a base shape and an extension in one key order, so parsed objects keep today's order. */
export function orderedShape(
	base: z.ZodRawShape,
	extension: z.ZodRawShape | undefined,
	order: readonly string[] | undefined,
): z.ZodRawShape {
	const merged: z.ZodRawShape = { ...base, ...extension };
	if (!order) return merged;
	const keys = Object.keys(merged);
	const missing = keys.filter((key) => !order.includes(key));
	const extra = order.filter((key) => !(key in merged));
	if (missing.length > 0 || extra.length > 0) {
		throw new Error(
			`shape order mismatch: missing ${missing.join(", ") || "none"}, extra ${extra.join(", ") || "none"}`,
		);
	}
	return Object.fromEntries(order.map((key) => [key, merged[key]!]));
}

export function createProjectSchema(plugin?: VideoEditorPlugin): z.ZodType<PostProject> {
	const coreKinds = (Object.keys(CORE_ITEM_SHAPES) as (keyof typeof CORE_ITEM_SHAPES)[]).map(
		(kind) => {
			const extension = plugin?.kindExtensions?.[kind];
			const schema = z
				.object(orderedShape(CORE_ITEM_SHAPES[kind], extension?.shape, extension?.order))
				.strict();
			// Today's PostVideoItemSchema is .strict().refine(...); keep the refine on the video kind.
			if (kind !== "video") return schema;
			return schema.refine(
				(item) =>
					(item as { sourceOut: number }).sourceOut > (item as { sourceIn: number }).sourceIn,
				{ message: "A clip must end after it starts", path: ["sourceOut"] },
			);
		},
	);
	const pluginKinds = (plugin?.itemKinds ?? []).map((definition) => definition.schema);
	const item = z.discriminatedUnion("kind", [...coreKinds, ...pluginKinds] as never, {
		error: (issue) => {
			const input = issue.input as { kind?: unknown } | undefined;
			return `Unknown post item kind "${String(input?.kind)}"`;
		},
	});
	// PostTrackSchema and PostProjectSchema are both .strict() today, and a project has a track.
	const track = z.object({ ...CORE_TRACK_SHAPE, items: z.array(item) }).strict();
	const project = z
		.object(
			orderedShape(
				{
					...CORE_PROJECT_SHAPE,
					tracks: z.array(track).min(1),
					music: createPostMusicSchema(plugin?.isMediaUrl ?? isNonEmptyString).optional(),
				},
				plugin?.projectExtension?.shape,
				plugin?.projectExtension?.order,
			),
		)
		.strict()
		.superRefine(refineUniqueIds);
	return project as unknown as z.ZodType<PostProject>;
}
