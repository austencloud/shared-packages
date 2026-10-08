import { z } from "zod";
import { PostTakeRefSchema, PostTakeSchema } from "../plan/post-plan.js";
import { BREAKDOWN_GEOMETRY } from "../plan/presets.js";
import { createPostMusicSchema } from "../music/post-music.js";
import type { VideoEditorPlugin } from "../../plugin.js";
import { kindDefinition } from "./kind-lookup.js";
import type {
	CoreItemKind,
	PostItem,
	PostItemKind,
	PostProject,
	PostTrack,
	PostVideoItem,
} from "./item-kinds.js";

/**
 * A post as Austen edits it on the timeline: tracks of items, InShot style.
 *
 * `tracks[0]` is the main track. Clips normally follow one another, but a
 * dragged clip keeps its chosen start and can leave a gap. Every later track is drawn
 * above the ones before it; its items keep their own times and follow the
 * main clip they are anchored to. `normalizeProject` in `normalize.ts` owns
 * those rules; every edit ends there.
 *
 * The compiler turns a project into the free-layout preset the evaluator,
 * the preview and the export already play.
 */

const IdSchema = z.string().trim().min(1);
const SecondsSchema = z.number().finite().nonnegative();

export const POST_PROJECT_SCHEMA_VERSION = 2;

export const POST_MIN_SPEED = 0.25;
export const POST_MAX_SPEED = 4;
export const POST_MIN_ZOOM = 0.5;
export const POST_MAX_ZOOM = 4;
export const POST_MAX_VOLUME = 2;
/** Shorter than this, a piece is too small to see or to grab. */
export const POST_MIN_ITEM_SECONDS = 0.1;
/** A box smaller than this, as a share of the frame, cannot be grabbed. */
export const POST_MIN_BOX_SIZE = 0.05;
export const POST_MAX_TEXT_LENGTH = 140;
export const POST_MAX_LABEL_LENGTH = 60;
export const POST_DEFAULT_CARD_SECONDS = 5;
export const POST_DEFAULT_OVERLAY_SECONDS = 3;
/** The export's frame rate; nudges step by one of its frames. */
export const POST_FRAME_RATE = 30;
/** Times closer than this are the same time. */
export const POST_TIME_EPSILON = 1e-6;
/** Keyframes this close in post seconds are the same moment, and merge. */
export const POST_KEYFRAME_MERGE_SECONDS = 1 / (2 * POST_FRAME_RATE);
/** A bezier control point's x, like CSS, must stay inside the unit interval. */
export const POST_EASING_X_MIN = 0;
export const POST_EASING_X_MAX = 1;
/** A bezier control point's y may over- or undershoot, for a spring feel. */
export const POST_EASING_Y_MIN = -1;
export const POST_EASING_Y_MAX = 2;

export const MAIN_TRACK_INDEX = 0;

/**
 * Where an item sits in the frame, as shares of its width and height, and
 * how far the whole item is turned about the box's centre: degrees
 * clockwise, left out when it sits straight. The unturned box stays inside
 * the frame; turned, its corners may run past the edge.
 */
export const PostBoxSchema = z
	.object({
		x: z.number().finite().min(0).max(1),
		y: z.number().finite().min(0).max(1),
		width: z.number().finite().min(POST_MIN_BOX_SIZE).max(1),
		height: z.number().finite().min(POST_MIN_BOX_SIZE).max(1),
		turn: z.number().finite().min(-180).max(180).optional(),
	})
	.strict()
	.refine((box) => box.x + box.width <= 1 + POST_TIME_EPSILON, {
		message: "A box must stay inside the frame",
		path: ["width"],
	})
	.refine((box) => box.y + box.height <= 1 + POST_TIME_EPSILON, {
		message: "A box must stay inside the frame",
		path: ["height"],
	});

export type PostBox = z.infer<typeof PostBoxSchema>;

/**
 * The main clip an overlay follows. Its start is the clip's start plus the
 * offset, so moving or retiming the clip carries the overlay with it.
 */
export const PostAnchorSchema = z
	.object({
		itemId: IdSchema,
		offset: z.number().finite(),
	})
	.strict();

export type PostAnchor = z.infer<typeof PostAnchorSchema>;

// ---------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------

const easingXSchema = z.number().finite().min(POST_EASING_X_MIN).max(POST_EASING_X_MAX);
const easingYSchema = z.number().finite().min(POST_EASING_Y_MIN).max(POST_EASING_Y_MAX);

/** A CSS `cubic-bezier(x1, y1, x2, y2)`, or a hold until the next keyframe. */
export const PostEasingSchema = z.union([
	z.literal("hold"),
	z.tuple([easingXSchema, easingYSchema, easingXSchema, easingYSchema]),
	z
		.object({
			kind: z.literal("sampled-bezier"),
			curve: z.tuple([easingXSchema, easingYSchema, easingXSchema, easingYSchema]),
			samples: z.literal(300),
		})
		.strict(),
]);

export type PostEasing = z.infer<typeof PostEasingSchema>;

/** Zoom, pan and turn together, as one keyframed picture framing. */
export const PostFramingSchema = z
	.object({
		zoom: z.number().finite().min(POST_MIN_ZOOM).max(POST_MAX_ZOOM),
		panX: z.number().finite().min(-0.5).max(0.5),
		panY: z.number().finite().min(-0.5).max(0.5),
		rotation: z.number().finite().min(-180).max(180),
	})
	.strict();

export type PostFraming = z.infer<typeof PostFramingSchema>;

function postKeyframeSchema<V extends z.ZodTypeAny>(value: V) {
	return z
		.object({
			/** Content time: see `keyframes.ts` for the two clocks. */
			t: z.number().finite(),
			value,
			/** How the value travels to the next keyframe. */
			easing: PostEasingSchema,
			/**
			 * Marks keys written by the opening tunnel or the picture-in-picture
			 * hand-off. A plugin's normalize hooks keep them in step with the opening
			 * tunnel and the hand-off until edited; an edit makes the key the
			 * author's own.
			 */
			auto: PostMotionKeySchema.optional(),
		})
		.strict();
}

/** Which automatic move wrote a keyframe. */
export const PostMotionKeySchema = z.enum(["tunnel", "handoff"]);
export type PostMotionKey = z.infer<typeof PostMotionKeySchema>;

export type PostKeyframe<V> = {
	t: number;
	value: V;
	easing: PostEasing;
	auto?: PostMotionKey;
};

/** Channels an item's `keyframes` may animate; `framing` is video only. */
export type PostKeyframeChannel = "framing" | "sourceGeometry" | "box" | "opacity";

/** The drawn media rectangle may pass outside the canvas. Crop coordinates are source UVs. */
export const PostSourceGeometrySchema = z
	.object({
		x: z.number().finite(),
		y: z.number().finite(),
		width: z.number().finite().positive(),
		height: z.number().finite().positive(),
		rotation: z.number().finite(),
		crop: z
			.object({
				left: z.number().finite().min(0).max(1),
				top: z.number().finite().min(0).max(1),
				right: z.number().finite().min(0).max(1),
				bottom: z.number().finite().min(0).max(1),
			})
			.strict()
			.refine((crop) => crop.right > crop.left && crop.bottom > crop.top),
	})
	.strict();
export type PostSourceGeometry = z.infer<typeof PostSourceGeometrySchema>;

export const PostAutoAdjustSchema = z
	.object({
		enabled: z.boolean(),
		strength: z.number().finite().min(0).max(1),
		startSeconds: SecondsSchema.optional(),
		endSeconds: SecondsSchema.optional(),
	})
	.strict();
export type PostAutoAdjust = z.infer<typeof PostAutoAdjustSchema>;

export const PostTransitionOutSchema = z
	.object({
		duration: SecondsSchema,
		type: z.enum(["crossfade", "fade-black"]),
		sourceTypeCode: z.string().optional(),
		incomingId: z.string().optional(),
		editorAddedSeconds: SecondsSchema.optional(),
	})
	.strict();
export type PostTransitionOut = z.infer<typeof PostTransitionOutSchema>;

const PostKeyframeBoxSchema = postKeyframeSchema(PostBoxSchema);
const PostKeyframeOpacitySchema = postKeyframeSchema(z.number().finite().min(0).max(1));
const PostKeyframeFramingSchema = postKeyframeSchema(PostFramingSchema);
const PostKeyframeSourceGeometrySchema = postKeyframeSchema(PostSourceGeometrySchema);

/** Every kind: where it sits, and how it fades in and out over its fades. */
const PostItemKeyframesSchema = z
	.object({
		box: z.array(PostKeyframeBoxSchema).optional(),
		opacity: z.array(PostKeyframeOpacitySchema).optional(),
	})
	.strict();

/** Video only: also its zoom, pan and turn. */
const PostVideoItemKeyframesSchema = z
	.object({
		framing: z.array(PostKeyframeFramingSchema).optional(),
		sourceGeometry: z.array(PostKeyframeSourceGeometrySchema).optional(),
		box: z.array(PostKeyframeBoxSchema).optional(),
		opacity: z.array(PostKeyframeOpacitySchema).optional(),
	})
	.strict();

export interface PostItemKeyframes {
	framing?: PostKeyframe<PostFraming>[];
	sourceGeometry?: PostKeyframe<PostSourceGeometry>[];
	box?: PostKeyframe<PostBox>[];
	opacity?: PostKeyframe<number>[];
}

/** The shapes a post can be, width by height; 9:16 when a project names none. */
export const POST_CANVAS_RATIOS = ["9:16", "4:5", "1:1", "16:9", "3:4", "4:3"] as const;
export type PostCanvasRatio = (typeof POST_CANVAS_RATIOS)[number];
export const POST_DEFAULT_CANVAS: PostCanvasRatio = "9:16";

/**
 * What fills the frame where no item covers it: the dark colour, or the main
 * clip playing, filling the frame and blurred, as phone editors offer.
 */
export const POST_BACKGROUNDS = ["dark", "blur"] as const;
export type PostBackground = (typeof POST_BACKGROUNDS)[number];
export const POST_DEFAULT_BACKGROUND: PostBackground = "dark";

/**
 * A clip's own shape inside its spot. `original` is the footage's shape and
 * `free` one dragged by hand; either way `ratio` holds the width over height
 * it was given, in output pixels.
 */
export const POST_CLIP_SHAPES = ["original", "free", ...POST_CANVAS_RATIOS] as const;
export type PostClipShapeKind = (typeof POST_CLIP_SHAPES)[number];
export const POST_SHAPE_RATIO_MIN = 0.25;
export const POST_SHAPE_RATIO_MAX = 4;

export const PostClipShapeSchema = z
	.object({
		kind: z.enum(POST_CLIP_SHAPES),
		ratio: z.number().finite().min(POST_SHAPE_RATIO_MIN).max(POST_SHAPE_RATIO_MAX),
	})
	.strict();

export type PostClipShape = z.infer<typeof PostClipShapeSchema>;

/** The colours a clip's border comes in. */
export const POST_EDGE_COLORS = [
	"white",
	"black",
	"red",
	"orange",
	"gold",
	"blue",
	"violet",
] as const;
export type PostEdgeColor = (typeof POST_EDGE_COLORS)[number];
/** A border this wide, as a share of the post's shorter side, is the widest. */
export const POST_MAX_EDGE_BORDER = 0.03;
/** A corner this round, as a share of the picture's shorter side, is a full curve. */
export const POST_MAX_EDGE_CORNERS = 0.5;

/**
 * A clip's edges, as editors dress picture-in-picture: rounded corners, a
 * border inside them and a drop shadow under the picture.
 */
export const PostClipEdgeSchema = z
	.object({
		/** Corner radius, as a share of the drawn picture's shorter side. */
		corners: z.number().finite().min(0).max(POST_MAX_EDGE_CORNERS),
		/** Border width, as a share of the post's shorter side. */
		border: z.number().finite().min(0).max(POST_MAX_EDGE_BORDER),
		borderColor: z.enum(POST_EDGE_COLORS),
		/** Drop shadow strength: 0 is none, 1 the darkest. */
		shadow: z.number().finite().min(0).max(1),
	})
	.strict();

export type PostClipEdge = z.infer<typeof PostClipEdgeSchema>;

/** Plain square edges: what a clip without `edge` shows. */
export const POST_PLAIN_EDGE: PostClipEdge = {
	corners: 0,
	border: 0,
	borderColor: "white",
	shadow: 0,
};

const itemBase = {
	id: IdSchema,
	/** Austen's own name for it; the kind's name shows when absent. */
	label: z.string().trim().max(POST_MAX_LABEL_LENGTH).optional(),
	/** Post seconds. Derived on the main track unless pinnedStart is true. */
	start: SecondsSchema,
	/** A main clip placed by hand keeps its timeline time through normalization. */
	pinnedStart: z.boolean().optional(),
	/** Post seconds. Derived for video, from its source span and speed. */
	duration: z.number().finite().positive(),
	box: PostBoxSchema,
	opacity: z.number().finite().min(0).max(1),
	fadeIn: SecondsSchema,
	fadeOut: SecondsSchema,
	transitionOut: PostTransitionOutSchema.optional(),
	/** Overlays only; always null on the main track. */
	anchor: PostAnchorSchema.nullable(),
	/** Overlays only: span exactly the anchored main clip. */
	fill: z.boolean(),
	/** Optional animation on this item's box and opacity. */
	keyframes: PostItemKeyframesSchema.optional(),
};

/** The fields every item kind shares. A plugin builds its own kinds' shapes from it. */
export const POST_ITEM_BASE_SHAPE = itemBase;

const videoItemShape = {
	...itemBase,
	kind: z.literal("video"),
	/** Overrides the base: video also keyframes its framing. */
	keyframes: PostVideoItemKeyframesSchema.optional(),
	sourceGeometry: PostSourceGeometrySchema.optional(),
	autoAdjust: PostAutoAdjustSchema.optional(),
	colorGrade: z
		.object({
			brightness: z.number().finite().min(0.5).max(1.5),
			contrast: z.number().finite().min(0.5).max(1.5),
			saturation: z.number().finite().min(0).max(2),
			hue: z.number().finite().min(-180).max(180).optional(),
		})
		.strict()
		.optional(),
	takeId: IdSchema,
	/** Take media seconds. */
	sourceIn: SecondsSchema,
	/** Take media seconds. */
	sourceOut: z.number().finite().positive(),
	speed: z.number().finite().min(POST_MIN_SPEED).max(POST_MAX_SPEED),
	/** cover crops to fill the box; contain shows the whole picture. */
	fit: z.enum(["cover", "contain"]),
	/**
	 * The clip's own shape, the largest of it centred in the box. Without
	 * one the clip fills the box.
	 */
	shape: PostClipShapeSchema.optional(),
	/** Rounded corners, a border and a shadow; square and bare when absent. */
	edge: PostClipEdgeSchema.optional(),
	/** Scales the picture about the box's centre. */
	zoom: z.number().finite().min(POST_MIN_ZOOM).max(POST_MAX_ZOOM),
	/**
	 * Moves the picture across whatever overflows the box: +/-0.5 reaches
	 * either edge, and with nothing overflowing it has no effect.
	 */
	panX: z.number().finite().min(-0.5).max(0.5),
	panY: z.number().finite().min(-0.5).max(0.5),
	rotation: z.number().finite().min(-180).max(180),
	/** Mirrors the footage; notation is never flipped with it. */
	flip: z.boolean(),
	/** 1 is the take as recorded; 0 is silent. */
	volume: z.number().finite().min(0).max(POST_MAX_VOLUME),
};

export const PostVideoItemSchema = z
	.object(videoItemShape)
	.strict()
	.refine((item) => item.sourceOut > item.sourceIn, {
		message: "A clip must end after it starts",
		path: ["sourceOut"],
	});

export type PostVideoItemCore = z.infer<typeof PostVideoItemSchema>;

const imageItemShape = {
	...itemBase,
	kind: z.literal("image"),
	imageId: IdSchema,
	/** QR artwork can follow the post theme or use a chosen contrast. */
	qrAppearance: z.enum(["light", "dark"]).optional(),
	sourceGeometry: PostSourceGeometrySchema.optional(),
	keyframes: z
		.object({
			sourceGeometry: z.array(PostKeyframeSourceGeometrySchema).optional(),
			box: z.array(PostKeyframeBoxSchema).optional(),
			opacity: z.array(PostKeyframeOpacitySchema).optional(),
		})
		.strict()
		.optional(),
};

export const PostImageItemSchema = z.object(imageItemShape).strict();
export type PostImageItemCore = z.infer<typeof PostImageItemSchema>;

export const PostImageSchema = z
	.object({
		id: IdSchema,
		label: z.string().trim().min(1).max(120),
		ref: PostTakeRefSchema,
	})
	.strict();
export type PostImage = z.infer<typeof PostImageSchema>;
export const PostFontSchema = z
	.object({
		family: z.string().min(1),
		ref: PostTakeRefSchema,
	})
	.strict();
export type PostFont = z.infer<typeof PostFontSchema>;

const cardItemShape = {
	...itemBase,
	kind: z.literal("card"),
};

export const PostCardItemSchema = z.object(cardItemShape).strict();

export type PostCardItemCore = z.infer<typeof PostCardItemSchema>;

export const PostTextSizeSchema = z.enum(["s", "m", "l"]);
export type PostTextSize = z.infer<typeof PostTextSizeSchema>;

export const PostTextStyleSchema = z
	.object({
		fontFamily: z.string().min(1),
		fontSizeNative: z.number().finite().positive(),
		fontScale: z.number().finite().positive().optional(),
		sourceCanvasWidth: z.number().finite().positive().optional(),
		letterSpacing: z.number().finite(),
		lineSpacing: z.number().finite().positive(),
		alignment: z.enum(["left", "center", "right"]),
		alpha: z.number().finite().min(0).max(1),
	})
	.strict();
export type PostTextStyle = z.infer<typeof PostTextStyleSchema>;

export const PostTextAnimationSchema = z
	.object({
		kind: z.literal("letter-slide"),
		inDurationSeconds: SecondsSchema,
		outDurationSeconds: SecondsSchema,
		entranceProgress: z.number().finite(),
		exitProgress: z.number().finite(),
	})
	.strict();
export type PostTextAnimation = z.infer<typeof PostTextAnimationSchema>;

const textItemShape = {
	...itemBase,
	kind: z.literal("text"),
	text: z.string().max(POST_MAX_TEXT_LENGTH),
	size: PostTextSizeSchema,
	style: PostTextStyleSchema.optional(),
	animation: PostTextAnimationSchema.optional(),
};

export const PostTextItemSchema = z.object(textItemShape).strict();

export type PostTextItemCore = z.infer<typeof PostTextItemSchema>;

/**
 * The raw shapes of the four core item kinds. `createProjectSchema` builds the item union
 * from them, with a plugin's fields added to a kind and its own kinds after them.
 */
export const CORE_ITEM_SHAPES = {
	video: videoItemShape,
	image: imageItemShape,
	card: cardItemShape,
	text: textItemShape,
} as const satisfies Record<CoreItemKind, z.ZodRawShape>;

/** Kinds the main track holds; anything else lives on an overlay track. */
export const MAIN_TRACK_KINDS: readonly PostItemKind[] = ["video", "image", "card"];

export const CORE_TRACK_SHAPE = {
	id: IdSchema,
	/** Left out of the preview and the export. */
	hidden: z.boolean(),
	/** Its items cannot be moved, trimmed or removed. */
	locked: z.boolean(),
};

/** The four core kinds alone, the item union of a host without a plugin. */
const CoreItemSchema = z.discriminatedUnion("kind", [
	PostVideoItemSchema,
	PostImageItemSchema,
	PostCardItemSchema,
	PostTextItemSchema,
]);
const CoreTrackSchema = z.object({ ...CORE_TRACK_SHAPE, items: z.array(CoreItemSchema) }).strict();

export type PostTrackCore = z.infer<typeof CoreTrackSchema>;

export const CORE_PROJECT_SHAPE = {
	schemaVersion: z.literal(POST_PROJECT_SCHEMA_VERSION),
	/** The host's id for what the post is about. Optional: a plugin may carry its own. */
	subjectId: IdSchema.optional(),
	takes: z.array(PostTakeSchema),
	images: z.array(PostImageSchema).optional(),
	fonts: z.array(PostFontSchema).optional(),
	importSource: z
		.object({
			format: z.literal("inshot-recovery"),
			rawDraftText: z.string(),
			unresolved: z.array(z.string()),
		})
		.strict()
		.optional(),
	tracks: z.array(CoreTrackSchema).min(1),
	/**
	 * - takes: each clip carries its take's sound at its own volume.
	 * - silent: the takes are muted, for music added in the app it is
	 *   posted from. A feature video's own `music` plays either way.
	 */
	audio: z.enum(["takes", "silent"]),
	/**
	 * A feature video's song under the whole post, heard in the preview and
	 * the export.
	 */
	music: createPostMusicSchema().optional(),
	/** The post's shape, and so the export's size; 9:16 when absent. */
	canvas: z.enum(POST_CANVAS_RATIOS).optional(),
	/** What fills the frame where no item covers it; dark when absent. */
	background: z.enum(POST_BACKGROUNDS).optional(),
	/** Reflect the post's layout and footage for a mirrored teaching view. */
	mirrored: z.boolean().optional(),
	updatedAt: z.number().finite().int().nonnegative(),
};

export type PostProjectCore = z.infer<z.ZodObject<typeof CORE_PROJECT_SHAPE>>;

/** What `refineUniqueIds` reads from a project. */
interface UniqueIdSource {
	takes: readonly { id: string }[];
	tracks: readonly { id: string; items: readonly { id: string }[] }[];
}

/** Take ids, track ids and item ids are each unique across the project. */
export function refineUniqueIds(input: object, context: z.RefinementCtx): void {
	const project = input as UniqueIdSource;
	const unique = (
		ids: readonly string[],
		path: (index: number) => (string | number)[],
		message: string,
	) => {
		const seen = new Set<string>();
		ids.forEach((id, index) => {
			if (seen.has(id)) {
				context.addIssue({ code: "custom", path: path(index), message });
			}
			seen.add(id);
		});
	};
	unique(
		project.takes.map((take) => take.id),
		(index) => ["takes", index, "id"],
		"Duplicate take id",
	);
	unique(
		project.tracks.map((track) => track.id),
		(index) => ["tracks", index, "id"],
		"Duplicate track id",
	);
	const itemIds = project.tracks.flatMap((track, trackIndex) =>
		track.items.map((item, itemIndex) => ({
			id: item.id,
			path: ["tracks", trackIndex, "items", itemIndex, "id"],
		})),
	);
	unique(
		itemIds.map((entry) => entry.id),
		(index) => itemIds[index]!.path,
		"Duplicate item id",
	);
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

/** Named places in the frame the looks and the Add menu use. */
export const POST_BOX = {
	full: { x: 0, y: 0, width: 1, height: 1 },
	/** The dual view: the take above... */
	top: { x: 0, y: 0, width: 1, height: 0.5 },
	/** ...and the animation below, a 1080 x 960 panel. */
	bottom: { x: 0, y: 0.5, width: 1, height: 0.5 },
	/** The breakdown strip's square, bottom left. */
	stripSquare: {
		x: 0,
		y: BREAKDOWN_GEOMETRY.stripTop,
		width: BREAKDOWN_GEOMETRY.animationWidth,
		height: BREAKDOWN_GEOMETRY.stripHeight,
	},
	/** The strip's carousel, beside the square. */
	stripCarousel: {
		x: BREAKDOWN_GEOMETRY.animationWidth,
		y: BREAKDOWN_GEOMETRY.stripTop,
		width: BREAKDOWN_GEOMETRY.carouselWidth,
		height: BREAKDOWN_GEOMETRY.stripHeight,
	},
	/** The whole strip, for a square or a carousel on its own. */
	stripWide: {
		x: 0,
		y: BREAKDOWN_GEOMETRY.stripTop,
		width: 1,
		height: BREAKDOWN_GEOMETRY.stripHeight,
	},
	/** The frame above the strip, so the footage is not covered. */
	aboveStrip: {
		x: 0,
		y: 0,
		width: 1,
		height: BREAKDOWN_GEOMETRY.stripTop,
	},
} as const satisfies Record<string, PostBox>;

export type PostTextPlacement = "top" | "middle" | "bottom";

/** A text box is 86% of the frame wide, like a caption, and two lines tall. */
export const TEXT_BOX_WIDTH = 0.86;
export const TEXT_BOX_HEIGHT = 0.14;
/**
 * Where a text box's centre sits for each quick placement: top and bottom
 * stay clear of a phone's status bar and Instagram's controls, and bottom
 * clears the strip.
 */
export const TEXT_PLACEMENT_CENTER: Record<PostTextPlacement, number> = {
	top: 0.12,
	middle: 0.5,
	bottom: 0.82,
};

export function textBox(placement: PostTextPlacement): PostBox {
	return {
		x: (1 - TEXT_BOX_WIDTH) / 2,
		y: TEXT_PLACEMENT_CENTER[placement] - TEXT_BOX_HEIGHT / 2,
		width: TEXT_BOX_WIDTH,
		height: TEXT_BOX_HEIGHT,
	};
}

/** Where an item added from the Add menu first appears. */
export function defaultBoxFor(kind: PostItemKind, plugin?: VideoEditorPlugin): PostBox {
	switch (kind) {
		case "video":
		case "image":
		case "card":
			return { ...POST_BOX.full };
		case "text":
			return textBox("top");
		default: {
			// A plugin's kind: its definition knows where it first appears.
			const definition = kindDefinition(plugin, kind);
			if (!definition) throw new Error(`Unknown post item kind "${String(kind)}"`);
			return definition.defaultBox();
		}
	}
}

/**
 * A box moved or resized into the frame: at least the minimum size, no
 * larger than the frame, and shifted back inside rather than cut.
 */
export function clampBox(box: PostBox): PostBox {
	const width = Math.min(1, Math.max(POST_MIN_BOX_SIZE, box.width));
	const height = Math.min(1, Math.max(POST_MIN_BOX_SIZE, box.height));
	const turn = wrapDegrees(box.turn ?? 0);
	return {
		x: Math.min(1 - width, Math.max(0, box.x)),
		y: Math.min(1 - height, Math.max(0, box.y)),
		width,
		height,
		// A box turned back to straight drops its turn, so it reads as it did.
		...(turn !== 0 ? { turn } : {}),
	};
}

/** Degrees folded into [-180, 180]; values already inside are kept. */
export function wrapDegrees(value: number): number {
	if (value >= -180 && value <= 180) return value;
	return ((((value + 180) % 360) + 360) % 360) - 180;
}

/**
 * The turn from one angle to another the short way round, in degrees
 * (-180 to 180), so a blend from -180 to 175 turns 5 degrees, not 355.
 */
export function shortestTurn(from: number, to: number): number {
	return wrapDegrees(to - from);
}

/** A framing moved or turned back into its bounds, rotation wrapped. */
export function clampFraming(framing: PostFraming): PostFraming {
	return {
		zoom: Math.min(POST_MAX_ZOOM, Math.max(POST_MIN_ZOOM, framing.zoom)),
		panX: Math.min(0.5, Math.max(-0.5, framing.panX)),
		panY: Math.min(0.5, Math.max(-0.5, framing.panY)),
		rotation: wrapDegrees(framing.rotation),
	};
}

// ---------------------------------------------------------------------------
// Reading a project
// ---------------------------------------------------------------------------

export function itemEnd(item: Pick<PostItem, "start" | "duration">): number {
	return item.start + item.duration;
}

/** How long a clip plays in the post: its source span at its speed. */
export function videoPostSeconds(
	item: Pick<PostVideoItem, "sourceIn" | "sourceOut" | "speed">,
): number {
	return (item.sourceOut - item.sourceIn) / item.speed;
}

export interface LocatedItem {
	item: PostItem;
	trackIndex: number;
	itemIndex: number;
}

export function findItem(project: PostProject, itemId: string): LocatedItem | null {
	for (let trackIndex = 0; trackIndex < project.tracks.length; trackIndex++) {
		const items = project.tracks[trackIndex]!.items;
		const itemIndex = items.findIndex((item) => item.id === itemId);
		if (itemIndex >= 0) {
			return { item: items[itemIndex]!, trackIndex, itemIndex };
		}
	}
	return null;
}

export function mainItems(project: PostProject): readonly PostItem[] {
	return project.tracks[MAIN_TRACK_INDEX]?.items ?? [];
}

/** Keep linked motion on its own take during an overlap; free layers follow the incoming take. */
export function timingVideoAt(
	items: readonly PostItem[],
	seconds: number,
	anchorItemId?: string,
): PostVideoItem | null {
	let covering: PostVideoItem | null = null;
	for (const item of items) {
		if (
			item.kind !== "video" ||
			seconds < item.start - POST_TIME_EPSILON ||
			seconds >= itemEnd(item) - POST_TIME_EPSILON
		)
			continue;
		if (item.id === anchorItemId) return item;
		if (!covering || item.start >= covering.start) covering = item;
	}
	return covering;
}

/** The main clip playing at a post time; the later one at a shared edge. */
export function mainItemAt(project: PostProject, seconds: number): PostItem | null {
	for (const item of mainItems(project)) {
		if (seconds >= item.start - POST_TIME_EPSILON && seconds < itemEnd(item) - POST_TIME_EPSILON) {
			return item;
		}
	}
	return null;
}

/** The overlays that follow a main clip, on every track. */
export function overlaysAnchoredTo(project: PostProject, mainItemId: string): LocatedItem[] {
	const found: LocatedItem[] = [];
	project.tracks.forEach((track, trackIndex) => {
		if (trackIndex === MAIN_TRACK_INDEX) return;
		track.items.forEach((item, itemIndex) => {
			if (item.anchor?.itemId === mainItemId) {
				found.push({ item, trackIndex, itemIndex });
			}
		});
	});
	return found;
}

export function projectDurationSeconds(project: PostProject): number {
	let end = 0;
	for (const track of project.tracks) {
		for (const item of track.items) end = Math.max(end, itemEnd(item));
	}
	return end;
}

/**
 * True when [start, end) is free on a track, ignoring the item being moved.
 * Items that only touch at an edge do not overlap.
 */
export function trackHasRoom(
	track: PostTrack,
	start: number,
	end: number,
	exceptItemId?: string,
): boolean {
	return track.items.every(
		(item) =>
			item.id === exceptItemId ||
			end <= item.start + POST_TIME_EPSILON ||
			start >= itemEnd(item) - POST_TIME_EPSILON,
	);
}

/**
 * Hands out ids no item or track in the project uses yet: `video-1`,
 * `text-3`, `track-2`. Deterministic, so edits stay pure and testable.
 */
export function createIdAllocator(project: PostProject): (prefix: string) => string {
	const used = new Set<string>([
		...project.tracks.map((track) => track.id),
		...project.tracks.flatMap((track) => track.items.map((item) => item.id)),
	]);
	return (prefix) => {
		let n = 1;
		while (used.has(`${prefix}-${n}`)) n += 1;
		const id = `${prefix}-${n}`;
		used.add(id);
		return id;
	};
}

export const MAIN_TRACK_ID = "main";

/**
 * An empty project. `extensionFields` are a plugin's own project fields (tka: `sequenceId`),
 * placed right after `schemaVersion`.
 */
export function createEmptyPostProject(
	input: { now: number },
	extensionFields?: Record<string, unknown>,
): PostProject {
	return {
		schemaVersion: POST_PROJECT_SCHEMA_VERSION,
		...extensionFields,
		takes: [],
		tracks: [{ id: MAIN_TRACK_ID, hidden: false, locked: false, items: [] }],
		audio: "takes",
		updatedAt: input.now,
	};
}
