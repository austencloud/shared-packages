import {
	MediaCompositionPresetSchema,
	type MediaCompositionPreset,
	type MotionKey,
	type MotionTransformValue,
	type PresetClip,
	type PresetTransition,
	type PresetRegionKeyframesTrack,
	type PresetSourceRole,
	type PresetVisualClipMotion,
} from "../preset/preset-schema.js";
import { takeRole } from "../plan/plan-compiler.js";
import { POST_STUDIO_ROLE } from "../plan/presets.js";
import { MOVE_EASING, tunnelHookBoxKeys, type TunnelBackdropFrame } from "../tunnel-hook.js";
import { regionEdge } from "../project/clip-edge.js";
import {
	MAIN_TRACK_INDEX,
	POST_BOX,
	POST_TIME_EPSILON,
	clampBox,
	itemEnd,
	shortestTurn,
	type PostBox,
	type PostSourceGeometry,
	type PostTextSize,
	type PostTextStyle,
	type PostTextAnimation,
} from "../project/schema.js";
import type {
	PluginCompiledOutputs,
	PostItem,
	PostImageItem,
	PostProject,
	PostVideoItem,
} from "../project/item-kinds.js";
import { clipBox, postOutputSize, type PostOutputSize } from "../project/canvas.js";
import { channelValueAt, postSecondsOfKeyframe, sampleEasing } from "../project/keyframes.js";
import { kindDefinition } from "../project/kind-lookup.js";
import type { LayoutRegion, RegionEdge } from "../preset/layout-schema.js";
import type { PostTake } from "../plan/post-plan.js";
import type { VideoEditorPlugin } from "../../plugin.js";
import type { CompileEnv, CompileItemEnv, FootageIntro, VideoFootage } from "./hooks.js";

/**
 * Turns an edited project into the free-layout preset the evaluator, the
 * preview and the export already play, plus the video spans (for the audio
 * mix) and the text items (for `text-item-painter.ts`) resolved out of it.
 *
 * A plugin's item kinds compile through their definitions' `compile`, and its
 * `compileHooks` add the work around the core kinds (see `hooks.ts`).
 */

export const TEXT_ROLE_PREFIX = "text:";

function isTransitionVisual(item: PostItem, plugin: VideoEditorPlugin | undefined): boolean {
	// Read as a string: with no plugin kinds declared the narrowing below leaves `never`.
	const kind: string = item.kind;
	if (kind === "video" || kind === "image" || kind === "card") return true;
	if (kind === "text") return false;
	return kindDefinition(plugin, kind)?.transitionVisual === true;
}

export function textRole(itemId: string): string {
	return `${TEXT_ROLE_PREFIX}${itemId}`;
}

export function itemIdFromTextRole(role: string): string | null {
	return role.startsWith(TEXT_ROLE_PREFIX) ? role.slice(TEXT_ROLE_PREFIX.length) : null;
}

/**
 * A plain item's clip id is its own item id. A clip a plugin adds for an
 * item (a piece `<itemId>~<k>`, its overlay `<itemId>~<k>:overlay`, a
 * companion clip `<itemId>~<name>`) carries the item id before a `~`. Either
 * way the item it belongs to is the text up to the first `~`.
 */
export function itemIdFromClipId(clipId: string): string {
	const split = clipId.indexOf("~");
	return split === -1 ? clipId : clipId.slice(0, split);
}

export interface CompilePostProjectContext {
	/** When the preset was made; kept out of the project's own timestamp. */
	now: number;
	/** Paint the beat number, letter and progress over an overlaid animation.
	 *  Only a host with a painter for them asks for it. */
	animationOverlay?: boolean;
	/** The compiled preset's id; "post-project" when absent. */
	presetId?: string;
}

/** A drawn video item, flattened for the audio mixer. */
export interface CompiledVideoSegment {
	itemId: string;
	takeId: string;
	trackIndex: number;
	startSeconds: number;
	endSeconds: number;
	sourceIn: number;
	sourceOut: number;
	speed: number;
	volume: number;
}

/** A drawn text item, for `text-item-painter.ts` to read live. */
export interface CompiledTextItem {
	itemId: string;
	role: string;
	text: string;
	size: PostTextSize;
	style?: PostTextStyle;
	animation?: PostTextAnimation;
	box: PostBox;
	startSeconds: number;
	endSeconds: number;
}

/** The core's outputs; a plugin's (`PluginCompiledOutputs`) follow `texts`. */
export interface CompiledPostProject extends PluginCompiledOutputs {
	preset: MediaCompositionPreset;
	durationSeconds: number;
	/** Take ids the preset draws, in first-use order. */
	takeIds: string[];
	imageIds: string[];
	videoSegments: CompiledVideoSegment[];
	texts: CompiledTextItem[];
}

const OUTPUT_FRAME_RATE = 30;
const OUTPUT_BACKGROUND = "#08080c";

export const IDENTITY_TRANSFORM = {
	scale: 1,
	rotationDegrees: 0,
	translateX: 0,
	translateY: 0,
	flipHorizontal: false,
} as const;

const seconds = (value: number) => ({ unit: "seconds" as const, value });

function region(
	id: string,
	label: string,
	box: PostBox,
	fit: LayoutRegion["fit"],
	zIndex: number,
	edge?: RegionEdge,
): LayoutRegion {
	return {
		id,
		label,
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		zIndex,
		fit,
		clipContent: true,
		respectSafeArea: false,
		...(edge ? { edge } : {}),
		...(box.turn ? { turn: box.turn } : {}),
	};
}

function presetRole(
	key: string,
	label: string,
	resolution: PresetSourceRole["resolution"],
	acceptedKinds: PresetSourceRole["acceptedKinds"],
): PresetSourceRole {
	return { key, label, acceptedKinds, required: true, resolution };
}

/**
 * Keyed turns as the compiled track plays them: each continues from the one
 * before it the short way round, as the editor blends them, so a turn
 * across -180..180 does not spin.
 */
function continuousTurns(stored: readonly number[]): number[] {
	let turn = 0;
	return stored.map((value, index) => {
		turn = index === 0 ? value : turn + shortestTurn(stored[index - 1]!, value);
		return turn;
	});
}

function transformMotionKeys(item: PostVideoItem): MotionKey<MotionTransformValue>[] | undefined {
	const frames = item.keyframes?.framing;
	if (!frames || frames.length === 0) return undefined;
	const turns = continuousTurns(frames.map((kf) => kf.value.rotation));
	return frames.map((kf, index) => ({
		atSeconds: postSecondsOfKeyframe(item, kf.t),
		value: {
			scale: kf.value.zoom,
			rotationDegrees: turns[index]!,
			translateX: kf.value.panX,
			translateY: kf.value.panY,
		},
		easing: kf.easing,
	}));
}

function opacityMotionKeys(item: PostItem): MotionKey<number>[] | undefined {
	const frames = item.keyframes?.opacity;
	if (!frames || frames.length === 0) return undefined;
	return frames.map((kf) => ({
		atSeconds: postSecondsOfKeyframe(item, kf.t),
		value: kf.value,
		easing: kf.easing,
	}));
}

/** True when the clip plays during the intro. */
function playsDuring(item: PostItem, intro: FootageIntro): boolean {
	return (
		item.start < intro.start + intro.seconds - POST_TIME_EPSILON &&
		itemEnd(item) > intro.start + POST_TIME_EPSILON
	);
}

/**
 * The same footage cropped to fill the whole frame, centred where `geometry`
 * frames it, or `frame.zoom` times closer around `frame`'s centre. The
 * picture's shape is read back from `geometry`, which draws its crop
 * unstretched. Null for a slanted picture, which has no such crop.
 */
function fullFrameGeometry(
	geometry: PostSourceGeometry,
	output: PostOutputSize,
	frame?: TunnelBackdropFrame,
): PostSourceGeometry | null {
	const quarter = Math.round(geometry.rotation / 90);
	if (Math.abs(geometry.rotation - quarter * 90) > 1e-6) return null;
	const { crop } = geometry;
	const cropWidth = crop.right - crop.left;
	const cropHeight = crop.bottom - crop.top;
	const pictureRatio =
		(geometry.width * output.width * cropHeight) / (geometry.height * output.height * cropWidth);
	// The rect is drawn before its turn, so a quarter-turned picture fills the
	// frame from a rect on its side.
	const sideways = quarter % 2 !== 0;
	const width = sideways ? output.height / output.width : 1;
	const height = sideways ? output.width / output.height : 1;
	const rectRatio = (width * output.width) / (height * output.height);
	const zoom = frame?.zoom ?? 1;
	const share =
		pictureRatio > rectRatio
			? { x: rectRatio / pictureRatio / zoom, y: 1 / zoom }
			: { x: 1 / zoom, y: pictureRatio / rectRatio / zoom };
	const centreX = frame?.x ?? (crop.left + crop.right) / 2;
	const centreY = frame?.y ?? (crop.top + crop.bottom) / 2;
	const left = Math.min(1 - share.x, Math.max(0, centreX - share.x / 2));
	const top = Math.min(1 - share.y, Math.max(0, centreY - share.y / 2));
	return {
		x: (1 - width) / 2,
		y: (1 - height) / 2,
		width,
		height,
		rotation: geometry.rotation,
		crop: { left, top, right: left + share.x, bottom: top + share.y },
	};
}

/** Where a crossfade reframes its outgoing picture, in post seconds. */
interface FramingMatch {
	start: number;
	end: number;
	incoming: PostVideoItem;
}

/**
 * A crossfade between two cuts of one recording reframes the outgoing cut
 * onto the incoming one's framing while it dissolves, so the room holds
 * still and only the performer changes. Null for other footage, a cut with
 * no framing of its own, or a turn or flip that differs.
 */
function framingMatchFor(
	items: readonly PostItem[],
	item: PostVideoItem,
	takes: ReadonlyMap<string, PostTake>,
): FramingMatch | null {
	const transition = item.transitionOut;
	const incoming = items[items.indexOf(item) + 1];
	if (
		!transition?.duration ||
		transition.type !== "crossfade" ||
		incoming?.kind !== "video" ||
		(transition.incomingId !== undefined && transition.incomingId !== incoming.id) ||
		!item.sourceGeometry ||
		!incoming.sourceGeometry ||
		item.flip !== incoming.flip ||
		Math.abs(item.sourceGeometry.rotation - incoming.sourceGeometry.rotation) > 1e-6
	) {
		return null;
	}
	const from = takes.get(item.takeId)?.ref;
	const to = takes.get(incoming.takeId)?.ref;
	if (!from || !to || JSON.stringify(from) !== JSON.stringify(to)) return null;
	const start = Math.max(incoming.start, itemEnd(item) - transition.duration);
	const end = Math.min(itemEnd(item), itemEnd(incoming));
	if (end - start <= POST_TIME_EPSILON) return null;
	return { start, end, incoming };
}

/** Steps a reframe is laid out in; the evaluator blends straight between them. */
const FRAMING_MATCH_STEPS = 12;

/**
 * The outgoing picture's reframe as keys. Each step places the recording by
 * one zoom and offset, so the picture never stretches, and shows it through
 * a window moving from the old frame to the incoming cut's framing at that
 * moment, which may itself be moving; the steps follow the opening move's
 * curve.
 */
function framingMatchKeys(match: FramingMatch, from: PostSourceGeometry) {
	const placement = (geometry: PostSourceGeometry) => {
		const { crop } = geometry;
		const scaleX = geometry.width / Math.max(1e-9, crop.right - crop.left);
		const scaleY = geometry.height / Math.max(1e-9, crop.bottom - crop.top);
		return {
			scaleX,
			scaleY,
			x: geometry.x - crop.left * scaleX,
			y: geometry.y - crop.top * scaleY,
		};
	};
	const a = placement(from);
	const lerp = (u: number, v: number, p: number) => u + (v - u) * p;
	const at = (to: PostSourceGeometry, p: number): PostSourceGeometry => {
		const b = placement(to);
		const scaleX = lerp(a.scaleX, b.scaleX, p);
		const scaleY = lerp(a.scaleY, b.scaleY, p);
		const x = lerp(a.x, b.x, p);
		const y = lerp(a.y, b.y, p);
		const clamp = (value: number) => Math.min(1, Math.max(0, value));
		const left = clamp((lerp(from.x, to.x, p) - x) / scaleX);
		const top = clamp((lerp(from.y, to.y, p) - y) / scaleY);
		const right = clamp((lerp(from.x + from.width, to.x + to.width, p) - x) / scaleX);
		const bottom = clamp((lerp(from.y + from.height, to.y + to.height, p) - y) / scaleY);
		return {
			x: x + left * scaleX,
			y: y + top * scaleY,
			width: (right - left) * scaleX,
			height: (bottom - top) * scaleY,
			rotation: from.rotation,
			crop: { left, top, right, bottom },
		};
	};
	return Array.from({ length: FRAMING_MATCH_STEPS + 1 }, (_, step) => {
		const share = step / FRAMING_MATCH_STEPS;
		const atSeconds = match.start + (match.end - match.start) * share;
		const to = channelValueAt(match.incoming, "sourceGeometry", atSeconds);
		return {
			atSeconds,
			value: step === 0 ? from : at(to, sampleEasing(MOVE_EASING, share)),
			easing:
				step === FRAMING_MATCH_STEPS
					? ("hold" as const)
					: ([0, 0, 1, 1] as [number, number, number, number]),
		};
	});
}

function sourceGeometryKeys(
	item: PostVideoItem | PostImageItem,
	output?: PostOutputSize,
	intro?: FootageIntro | null,
) {
	const keys = item.keyframes?.sourceGeometry?.map((kf) => ({
		atSeconds: postSecondsOfKeyframe(item, kf.t),
		value: kf.value,
		easing: kf.easing,
	}));
	const full =
		intro && output && item.sourceGeometry
			? fullFrameGeometry(item.sourceGeometry, output, intro.frame)
			: null;
	if (intro && full) {
		// The intro sets the crop until it has settled; the item's own keys follow.
		const introKeys = tunnelHookBoxKeys(intro.start, intro.seconds, full, item.sourceGeometry!);
		const settledAt = introKeys[introKeys.length - 1]!.atSeconds;
		return [
			...introKeys,
			...(keys ?? []).filter((key) => key.atSeconds > settledAt + POST_TIME_EPSILON),
		];
	}
	if (!keys?.length) return undefined;
	// The native base matrix holds until the first authored transform key.
	if (item.sourceGeometry && keys[0]!.atSeconds > item.start + POST_TIME_EPSILON) {
		return [
			{
				atSeconds: item.start,
				value: item.sourceGeometry,
				easing: "hold" as const,
			},
			...keys,
		];
	}
	return keys;
}

/** The clip's `motion`, or undefined so an unanimated clip stays as it was. */
function motionFor(
	item: PostItem,
	transform?: MotionKey<MotionTransformValue>[],
): PresetVisualClipMotion | undefined {
	const opacity = opacityMotionKeys(item);
	if (!opacity && !transform) return undefined;
	return {
		...(transform ? { transform } : {}),
		...(opacity ? { opacity } : {}),
	};
}

/**
 * A `regionKeyframes` track for the item's own region, or undefined. A
 * shaped clip's region is its shape inside each keyed box. When any key is
 * turned, every key carries its turn, a straight one as 0. A tunnel intro
 * carries its canvas from the full frame into its box, and an uncropped video
 * behind it (`footageIntro`) makes the same move. The plugin's `regionSpan`
 * names an item's own intro span.
 */
function regionKeyframesFor(
	item: PostItem,
	output: PostOutputSize,
	footageIntro: FootageIntro | null,
	plugin: VideoEditorPlugin | undefined,
	env: CompileEnv,
): PresetRegionKeyframesTrack | null {
	const frames = item.keyframes?.box ?? [];
	const rectOf = (box: PostBox): PostBox =>
		item.kind === "video" ? clipBox(item, box, output) : box;
	const turns = frames.some((kf) => kf.value.turn !== undefined)
		? continuousTurns(frames.map((kf) => kf.value.turn ?? 0))
		: null;
	const own = frames.map((kf, index) => {
		const rect = rectOf(kf.value);
		return {
			atSeconds: postSecondsOfKeyframe(item, kf.t),
			value: turns ? { ...rect, turn: turns[index]! } : rect,
			easing: kf.easing,
		};
	});
	const span =
		plugin?.compileHooks?.regionSpan?.(item, env) ??
		(item.kind === "video" && !item.sourceGeometry ? footageIntro : null);
	if (span) {
		// The intro sets the box until it has settled; the item's own keys follow.
		const straight = (box: PostBox): PostBox => (turns ? { ...rectOf(box), turn: 0 } : rectOf(box));
		const intro = tunnelHookBoxKeys<PostBox>(
			span.start,
			span.seconds,
			straight({ ...POST_BOX.full }),
			straight({ ...item.box }),
		);
		const settledAt = intro[intro.length - 1]!.atSeconds;
		// A kind that owns its intro keys (tka: an animation's, which may be
		// edited) keeps them.
		if (
			kindDefinition(plugin, item.kind)?.ownsIntroKeys === true &&
			own.some((key) => key.atSeconds <= settledAt + POST_TIME_EPSILON)
		)
			return { regionId: item.id, keyframes: own };
		return {
			regionId: item.id,
			keyframes: [...intro, ...own.filter((key) => key.atSeconds > settledAt + POST_TIME_EPSILON)],
		};
	}
	if (own.length === 0) return null;
	return { regionId: item.id, keyframes: own };
}

export function compilePostProject(
	project: PostProject,
	context: CompilePostProjectContext,
	plugin?: VideoEditorPlugin,
): CompiledPostProject | null {
	const takes = new Map(project.takes.map((entry) => [entry.id, entry]));
	const images = new Map((project.images ?? []).map((entry) => [entry.id, entry]));
	const output = postOutputSize(project.canvas);
	// Pieces read a main video's timing even when its own track is hidden - the
	// footage still exists, Austen just doesn't want its own picture on screen.
	const mainVideos = (project.tracks[MAIN_TRACK_INDEX]?.items ?? []).filter(
		(item): item is PostVideoItem => item.kind === "video",
	);

	const regions: LayoutRegion[] = [];
	const regionKeyframesList: PresetRegionKeyframesTrack[] = [];
	const clips: PresetClip[] = [];
	const roleByKey = new Map<string, PresetSourceRole>();
	const takeIds: string[] = [];
	const imageIds: string[] = [];
	const transitions: PresetTransition[] = [];
	const videoSegments: CompiledVideoSegment[] = [];
	const texts: CompiledTextItem[] = [];
	// Each plugin output starts as its factory's empty array, in declaration order.
	const outputs: Record<string, unknown> = {};
	for (const [name, create] of Object.entries(plugin?.compileOutputs ?? {})) {
		outputs[name] = create();
	}
	let maxEnd = 0;

	const useRole = (entry: PresetSourceRole): void => {
		if (!roleByKey.has(entry.key)) roleByKey.set(entry.key, entry);
	};
	const useTake = (takeId: string): void => {
		if (!takeIds.includes(takeId)) takeIds.push(takeId);
		const take = takes.get(takeId);
		useRole(presetRole(takeRole(takeId), take?.label ?? takeId, "selected-video", ["video"]));
	};

	const hooks = plugin?.compileHooks;
	const env: CompileEnv = {
		project,
		context,
		state: new Map(),
		output,
		mainVideos,
		addRegion: (entry) => {
			regions.push(entry);
		},
		addRegionKeyframes: (track) => {
			regionKeyframesList.push(track);
		},
		addClip: (clip) => {
			clips.push(clip);
		},
		addOutput: (name, value) => {
			const list = outputs[name];
			if (!Array.isArray(list)) {
				throw new Error(`compile output "${name}" is not declared in compileOutputs`);
			}
			list.push(value);
		},
		useRole,
		useTake,
		region,
		presetRole,
		regionKeyframesFor: (item, size, intro = null) =>
			regionKeyframesFor(item, size, intro, plugin, env),
		motionFor,
		seconds,
	};
	// The plugin's footage intro and its pre-pass, before any item.
	const footageIntro = hooks?.footageIntro?.(env) ?? null;
	hooks?.begin?.(env);

	const compileItem = (item: PostItem, trackIndex: number): boolean => {
		const box = clampBox(item.box);
		const zIndex = (trackIndex + 1) * 10;
		const label = item.label ?? item.kind;
		// Read as a string: with no plugin kinds declared the switch below leaves `never`.
		const kind: string = item.kind;
		const itemEnv: CompileItemEnv = { ...env, trackIndex, zIndex, box, label };

		switch (item.kind) {
			case "video": {
				if (!takes.has(item.takeId)) return false;
				useTake(item.takeId);
				const roleKey = takeRole(item.takeId);
				regions.push(
					region(
						item.id,
						label,
						item.sourceGeometry ? { x: 0, y: 0, width: 1, height: 1 } : clipBox(item, box, output),
						item.fit,
						zIndex,
						regionEdge(item.edge),
					),
				);
				// The footage the tunnel plays over fills the frame with it.
				const intro =
					trackIndex === MAIN_TRACK_INDEX && footageIntro && playsDuring(item, footageIntro)
						? footageIntro
						: null;
				const regionKeyframes = env.regionKeyframesFor(item, output, intro);
				if (regionKeyframes) regionKeyframesList.push(regionKeyframes);
				const motion = motionFor(item, transformMotionKeys(item));
				const ownGeometryKeys = sourceGeometryKeys(item, output, intro);
				// A crossfade into another cut of the same recording reframes onto it.
				const match =
					trackIndex === MAIN_TRACK_INDEX
						? framingMatchFor(project.tracks[MAIN_TRACK_INDEX]!.items, item, takes)
						: null;
				// ...and the cut it reframes onto wears the same framing meanwhile.
				const outgoing =
					trackIndex === MAIN_TRACK_INDEX
						? project.tracks[MAIN_TRACK_INDEX]!.items[
								project.tracks[MAIN_TRACK_INDEX]!.items.indexOf(item) - 1
							]
						: undefined;
				const incomingMatch =
					outgoing?.kind === "video"
						? framingMatchFor(project.tracks[MAIN_TRACK_INDEX]!.items, outgoing, takes)
						: null;
				const geometryKeys = match
					? (() => {
							const before = (ownGeometryKeys ?? []).filter(
								(key) => key.atSeconds < match.start - POST_TIME_EPSILON,
							);
							return [
								...before,
								...framingMatchKeys(
									match,
									before[before.length - 1]?.value ?? item.sourceGeometry!,
								),
							];
						})()
					: ownGeometryKeys;
				const footage: VideoFootage = {
					regionId: item.id,
					start: seconds(item.start),
					end: seconds(itemEnd(item)),
					sourceIn: seconds(item.sourceIn),
					sourceOut: seconds(item.sourceOut),
					playbackRate: item.speed,
					loop: false as const,
					opacity: item.opacity,
					...(item.fadeIn > 0 ? { fadeInSeconds: item.fadeIn } : {}),
					...(item.fadeOut > 0 ? { fadeOutSeconds: item.fadeOut } : {}),
					transform: {
						scale: item.zoom,
						rotationDegrees: item.rotation,
						translateX: item.panX,
						translateY: item.panY,
						flipHorizontal: item.flip,
					},
					...(item.sourceGeometry ? { sourceGeometry: item.sourceGeometry } : {}),
					...(item.autoAdjust ? { autoAdjust: item.autoAdjust } : {}),
					...(item.colorGrade ? { colorGrade: item.colorGrade } : {}),
					...(geometryKeys ? { sourceGeometryKeyframes: geometryKeys } : {}),
					...(incomingMatch && outgoing
						? {
								framingFrom: {
									clipId: outgoing.id,
									start: incomingMatch.start,
									end: incomingMatch.end,
								},
							}
						: {}),
					...(motion ? { motion } : {}),
				};
				clips.push({
					id: item.id,
					kind: "visual",
					sourceRole: roleKey,
					...footage,
					useResolvedTimeMap: true,
					timeMapRole: roleKey,
				});
				// A plugin's clips that ride the footage come right after its own.
				hooks?.videoCompanions?.(item, itemEnv, footage);
				videoSegments.push({
					itemId: item.id,
					takeId: item.takeId,
					trackIndex,
					startSeconds: item.start,
					endSeconds: itemEnd(item),
					sourceIn: item.sourceIn,
					sourceOut: item.sourceOut,
					speed: item.speed,
					volume: item.volume,
				});
				return true;
			}

			case "image": {
				if (!images.has(item.imageId)) return false;
				if (!imageIds.includes(item.imageId)) imageIds.push(item.imageId);
				const roleKey = `image:${item.imageId}`;
				useRole(presetRole(roleKey, images.get(item.imageId)!.label, "manual", ["image"]));
				regions.push(
					region(
						item.id,
						label,
						item.sourceGeometry ? { x: 0, y: 0, width: 1, height: 1 } : box,
						"contain",
						zIndex,
					),
				);
				const regionKeyframes = env.regionKeyframesFor(item, output);
				if (regionKeyframes) regionKeyframesList.push(regionKeyframes);
				const motion = motionFor(item);
				clips.push({
					id: item.id,
					kind: "visual",
					sourceRole: roleKey,
					regionId: item.id,
					start: seconds(item.start),
					end: seconds(itemEnd(item)),
					sourceIn: seconds(0),
					sourceOut: seconds(item.duration),
					playbackRate: 1,
					loop: false,
					opacity: item.opacity,
					...(item.fadeIn > 0 ? { fadeInSeconds: item.fadeIn } : {}),
					...(item.fadeOut > 0 ? { fadeOutSeconds: item.fadeOut } : {}),
					transform: IDENTITY_TRANSFORM,
					useResolvedTimeMap: false,
					...(item.sourceGeometry ? { sourceGeometry: item.sourceGeometry } : {}),
					...(sourceGeometryKeys(item)
						? { sourceGeometryKeyframes: sourceGeometryKeys(item) }
						: {}),
					...(motion ? { motion } : {}),
				});
				return true;
			}

			case "card": {
				useRole(
					presetRole(POST_STUDIO_ROLE.card, "Choreo card", "linked-choreo-card", ["choreo-card"]),
				);
				regions.push(region(item.id, label, box, "contain", zIndex));
				{
					const regionKeyframes = env.regionKeyframesFor(item, output);
					if (regionKeyframes) regionKeyframesList.push(regionKeyframes);
				}
				const cardMotion = motionFor(item);
				clips.push({
					id: item.id,
					kind: "visual",
					sourceRole: POST_STUDIO_ROLE.card,
					regionId: item.id,
					start: seconds(item.start),
					end: seconds(itemEnd(item)),
					sourceIn: seconds(0),
					sourceOut: seconds(item.duration),
					playbackRate: 1,
					loop: false,
					opacity: item.opacity,
					...(item.fadeIn > 0 ? { fadeInSeconds: item.fadeIn } : {}),
					...(item.fadeOut > 0 ? { fadeOutSeconds: item.fadeOut } : {}),
					transform: IDENTITY_TRANSFORM,
					useResolvedTimeMap: false,
					...(cardMotion ? { motion: cardMotion } : {}),
				});
				return true;
			}

			case "text": {
				if (item.text.trim().length === 0) return false;
				const roleKey = textRole(item.id);
				useRole(presetRole(roleKey, "Text", "manual", ["image"]));
				regions.push(region(item.id, label, box, "fill", zIndex));
				{
					const regionKeyframes = env.regionKeyframesFor(item, output);
					if (regionKeyframes) regionKeyframesList.push(regionKeyframes);
				}
				const textMotion = motionFor(item);
				clips.push({
					id: item.id,
					kind: "visual",
					sourceRole: roleKey,
					regionId: item.id,
					start: seconds(item.start),
					end: seconds(itemEnd(item)),
					sourceIn: seconds(0),
					sourceOut: seconds(item.duration),
					playbackRate: 1,
					loop: false,
					opacity: item.opacity,
					...(item.fadeIn > 0 ? { fadeInSeconds: item.fadeIn } : {}),
					...(item.fadeOut > 0 ? { fadeOutSeconds: item.fadeOut } : {}),
					transform: IDENTITY_TRANSFORM,
					useResolvedTimeMap: false,
					...(textMotion ? { motion: textMotion } : {}),
				});
				texts.push({
					itemId: item.id,
					role: roleKey,
					text: item.text,
					size: item.size,
					...(item.style ? { style: item.style } : {}),
					...(item.animation ? { animation: item.animation } : {}),
					box,
					startSeconds: item.start,
					endSeconds: itemEnd(item),
				});
				return true;
			}

			default:
				// A plugin's kind compiles itself; a kind with no definition is
				// skipped, as an unknown kind always was.
				return kindDefinition(plugin, kind)?.compile(item, itemEnv) ?? false;
		}
	};

	project.tracks.forEach((track, trackIndex) => {
		if (track.hidden) return;
		for (const item of track.items) {
			if (compileItem(item, trackIndex)) maxEnd = Math.max(maxEnd, itemEnd(item));
		}
	});

	for (const track of project.tracks) {
		for (let index = 0; index < track.items.length - 1; index++) {
			const outgoing = track.items[index]!;
			const incoming = track.items[index + 1]!;
			if (
				!outgoing.transitionOut?.duration ||
				(outgoing.transitionOut.incomingId !== undefined &&
					outgoing.transitionOut.incomingId !== incoming.id) ||
				!isTransitionVisual(outgoing, plugin) ||
				!isTransitionVisual(incoming, plugin)
			)
				continue;
			const start = Math.max(incoming.start, itemEnd(outgoing) - outgoing.transitionOut.duration);
			const end = Math.min(itemEnd(outgoing), itemEnd(incoming));
			if (end <= start) continue;
			const outgoingClip = clips.find(
				(clip) =>
					clip.kind === "visual" && clip.regionId === outgoing.id && !clip.id.endsWith(":overlay"),
			);
			if (!outgoingClip) continue;
			const incomingClips = clips.filter(
				(clip) => clip.kind === "visual" && clip.regionId === incoming.id,
			);
			for (const clip of incomingClips) {
				transitions.push({
					id:
						incomingClips.length === 1
							? `transition:${outgoing.id}:${incoming.id}`
							: `transition:${outgoing.id}:${incoming.id}:${clip.id}`,
					kind: outgoing.transitionOut.type,
					outgoingClipId: outgoingClip.id,
					incomingClipId: clip.id,
					start: seconds(start),
					end: seconds(end),
					curve: "linear",
				});
			}
		}
	}

	if (clips.length === 0 || maxEnd <= 0) return null;

	// A blurred background draws the main clip on screen, so only main clips
	// the post draws can fill it.
	const drawn = new Set(clips.map((clip) => clip.id));
	const backdropClipIds =
		project.background === "blur"
			? mainVideos.map((item) => item.id).filter((id) => drawn.has(id))
			: [];

	const preset = MediaCompositionPresetSchema.parse({
		schemaVersion: 1,
		id: context.presetId ?? "post-project",
		ownerId: "post-project",
		name: "Post",
		createdAt: context.now,
		updatedAt: context.now,
		output: {
			...output,
			frameRate: OUTPUT_FRAME_RATE,
			backgroundColor: OUTPUT_BACKGROUND,
		},
		duration: { mode: "fixed", seconds: maxEnd },
		layoutModel: "free",
		sourceRoles: [...roleByKey.values()],
		regions,
		...(regionKeyframesList.length > 0 ? { regionKeyframes: regionKeyframesList } : {}),
		...(backdropClipIds.length > 0
			? { backdrop: { kind: "blur" as const, clipIds: backdropClipIds } }
			: {}),
		clips,
		transitions,
		audioMix: { masterGain: 1, tracks: [] },
		targetDefaults: {
			instagram: { delivery: "handoff", coverFrameSeconds: 0 },
		},
	} satisfies MediaCompositionPreset);

	// The core's outputs in their order, then the plugin's in `compileOutputs` order.
	const compiled = {
		preset,
		durationSeconds: maxEnd,
		takeIds,
		imageIds,
		videoSegments,
		texts,
		...outputs,
	};
	return compiled as CompiledPostProject;
}
