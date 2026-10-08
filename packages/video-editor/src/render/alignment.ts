import type { PostProject } from "../core/project/item-kinds.js";
import type { PipHandoffStep } from "../core/pip-sample.js";
import type { TakeSample, TakeSampleOptions } from "../core/sequence-types.js";
import type { SequenceTimeMap } from "../core/time-map.js";
import type { EvaluatedFrameLayer } from "./frame-evaluator.js";

/**
 * A take's timing, asked by media time. Each take has its own, so a post that
 * cuts between takes - or plays one slowed down - reads every frame's move
 * from the footage actually on screen rather than from the post's clock.
 */
export interface TakeClock {
	/** Where the take is at this media time, or null where nothing is mapped. */
	sampleAt(mediaSeconds: number, options?: TakeSampleOptions): TakeSample | null;
}

/**
 * The layer fields an alignment fills for a sampled layer, all from one frame
 * record so the square, the strip, the carousel and the beat number agree.
 */
export type AlignmentFields = Pick<
	EvaluatedFrameLayer,
	| "sequenceFrame"
	| "sequencePosition"
	| "sequencePassIndex"
	| "carouselPosition"
	| "animationTimeSeconds"
	| "displayedBeatNumber"
>;

/**
 * How a project's clock maps onto a repeating sequence of moves. The host
 * builds one per project and hands it to the evaluator; the evaluator never
 * builds one.
 */
export interface FrameAlignment {
	/** Beats per move, one entry per move; empty when there is no sequence. */
	moveBeats: readonly number[];
	/** Passes needed for this LOOP to return to its opening pose. */
	sequencePeriod?: number | undefined;
	/**
	 * Clocks by take role. A clip whose `timeMapRole` names one reads its move
	 * from that take's media time at the clip's own source time.
	 */
	clocks?: Readonly<Record<string, TakeClock>> | undefined;
	/**
	 * One map for the whole post, read at post time: the older single-take
	 * path, used by clips that name no clock.
	 */
	timeMap?: SequenceTimeMap | undefined;
	/**
	 * Where project time zero sits in `timeMap`'s media. A step map is recorded
	 * against the footage as shot, so trimming the head off a take moves the post
	 * clock away from the map's clock by exactly the amount trimmed. Adding it
	 * back here keeps the card on the step the performer is actually landing.
	 */
	mediaTimeOffsetSeconds?: number | undefined;
	/** Told why each hand-off side drew what it did; for tracing only. */
	explainHandoff?:
		| ((step: PipHandoffStep & { role: "from" | "to"; postSeconds: number }) => void)
		| undefined;
	/**
	 * The sequence fields a mapped layer carries, from one take sample. The
	 * evaluator calls it only for a layer that has a sample.
	 */
	frameFields(
		sample: TakeSample,
		moveBeats: readonly number[],
		holdLandings: boolean,
	): AlignmentFields;
}

/** Builds the alignment for a project, or null when the project has no sequence. */
export interface AlignmentProvider {
	create(project: PostProject): FrameAlignment | null;
}
