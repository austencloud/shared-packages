import type { LayoutRegion, RegionEdge } from "../preset/layout-schema.js";
import type {
	MotionKey,
	MotionTransformValue,
	PresetClip,
	PresetRegionKeyframesTrack,
	PresetSourceRole,
	PresetVisualClipMotion,
} from "../preset/preset-schema.js";
import type { PostOutputSize } from "../project/canvas.js";
import type { PostItem, PostProject, PostVideoItem } from "../project/item-kinds.js";
import type { PostBox } from "../project/schema.js";
import type { TunnelBackdropFrame } from "../tunnel-hook.js";
import type { CompilePostProjectContext } from "./compiler.js";

/**
 * What a plugin's compile hooks and item kinds see of `compilePostProject`:
 * the project, the preset being built and the compiler's own helpers, with
 * the names and signatures the compiler uses for its core kinds.
 */

/** Where a tunnel intro that plays over its footage runs, in post seconds. */
export interface FootageIntro {
	start: number;
	seconds: number;
	frame?: TunnelBackdropFrame;
}

/** The preset's visual clip, one member of `PresetClip`. */
type PresetVisualClip = Extract<PresetClip, { kind: "visual" }>;

/**
 * The fields a main video's clip is built from. A companion clip spreads the
 * same object and adds its own id, source role and time-map choice.
 */
export type VideoFootage = Omit<
	PresetVisualClip,
	"id" | "kind" | "sourceRole" | "useResolvedTimeMap" | "timeMapRole"
>;

export interface CompileEnv {
	readonly project: PostProject;
	readonly context: CompilePostProjectContext;
	/** Per-compile scratch space for hooks; the core never reads it. */
	readonly state: Map<string, unknown>;
	/** The output frame's size, from the project's canvas. */
	readonly output: PostOutputSize;
	/** The main track's videos, hidden or not, in track order. */
	readonly mainVideos: readonly PostVideoItem[];
	addRegion(region: LayoutRegion): void;
	addRegionKeyframes(track: PresetRegionKeyframesTrack): void;
	addClip(clip: PresetClip): void;
	/** Push onto a plugin output declared in `compileOutputs`. */
	addOutput(name: string, value: unknown): void;
	/** Lists a source role in the preset; the first use of a key wins and sets its place. */
	useRole(entry: PresetSourceRole): void;
	/** Lists a take, and its source role, in first-use order. */
	useTake(takeId: string): void;
	region(
		id: string,
		label: string,
		box: PostBox,
		fit: LayoutRegion["fit"],
		zIndex: number,
		edge?: RegionEdge,
	): LayoutRegion;
	presetRole(
		key: string,
		label: string,
		resolution: PresetSourceRole["resolution"],
		acceptedKinds: PresetSourceRole["acceptedKinds"],
	): PresetSourceRole;
	/** The item's own region keys, with any intro span the plugin's `regionSpan` names. */
	regionKeyframesFor(
		item: PostItem,
		output: PostOutputSize,
		footageIntro?: FootageIntro | null,
	): PresetRegionKeyframesTrack | null;
	/** The clip's `motion`, or undefined so an unanimated clip stays as it was. */
	motionFor(
		item: PostItem,
		transform?: MotionKey<MotionTransformValue>[],
	): PresetVisualClipMotion | undefined;
	seconds(value: number): { unit: "seconds"; value: number };
}

export interface CompileItemEnv extends CompileEnv {
	readonly trackIndex: number;
	/** The item's layer: `(trackIndex + 1) * 10`. */
	readonly zIndex: number;
	/** The item's box, clamped into the frame. */
	readonly box: PostBox;
	/** The item's label, or its kind. */
	readonly label: string;
}

/**
 * Hooks into `compilePostProject` for the work a plugin does around the core
 * kinds. Each must push regions, keyframes, clips and roles in the same order
 * on every run (array order is part of the compiled preset), and none may
 * change the project.
 */
export interface ProjectCompileHooks {
	/** Before the item loop (TKA: the picture-in-picture hand-off pre-pass). */
	begin?(env: CompileEnv): void;
	/** The footage intro for the main track (TKA: an animation item's tunnel intro over footage). */
	footageIntro?(env: CompileEnv): FootageIntro | null;
	/**
	 * Extra clips right after a video's own clip (TKA: the `~staff` effect
	 * clip). `footage` is the object the video's clip was built from.
	 */
	videoCompanions?(item: PostVideoItem, env: CompileItemEnv, footage: VideoFootage): void;
	/**
	 * An intro span the item's region keys start with, or null (TKA: an
	 * animation's tunnel intro). It runs before any item env exists, from the
	 * pre-pass too, so it sees only the `CompileEnv`.
	 */
	regionSpan?(item: PostItem, env: CompileEnv): { start: number; seconds: number } | null;
}
