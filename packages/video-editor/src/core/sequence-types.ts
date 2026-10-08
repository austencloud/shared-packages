/**
 * Which move is showing, worked out once per frame so the performer, the
 * animation square, the strip pictograph, the carousel and the beat number
 * cannot disagree.
 *
 * It reads an arrival position: 0 is the opening pose, and k is the landing of
 * move k, counting on across passes. Between landings the fraction is how far
 * through that move the performer is, whatever its length in beats.
 *
 * A move owns everything from just after the previous landing up to and
 * including its own landing: at exactly r = k the frame is move k, finished.
 * That is what the props show at that instant - move k's end position - and
 * it is why the landing that closes a pass still belongs to that pass rather
 * than wrapping to move 1 of the next.
 *
 * Once the performer makes their last landing the frame is holding: the pose
 * stays, and nothing that anticipates a next move (a carousel sliding on) may
 * run, because there is none.
 */
export type SequencePhase = "opening" | "moving" | "holding";

export interface SequenceFrame {
	/** The arrival position it was built from, never below 0. */
	arrival: number;
	phase: SequencePhase;
	/** Moves counted across passes: 1 is the first move ever. 0 opening. */
	absoluteMove: number;
	/** 1..N, the move in flight or just landed. 0 for the opening pose. */
	move: number;
	/** How far through `move`, in (0, 1]. 0 for the opening pose. */
	moveProgress: number;
	/** Zero-based repetition `move` belongs to. */
	pass: number;
	/** Position within the pass on the same count, 0..N. */
	passArrival: number;
	/** Share of the pass's beats elapsed, 0..1, for a progress bar. */
	passBeatProgress: number;
	/**
	 * Beats since the opening pose, across passes. Anything that animates with
	 * the performer - trails, a traced path - reads this, never a wall clock.
	 */
	beatsElapsed: number;
	/**
	 * The animation engine's count: [1, 2) is move 1 in flight, and N + 1 is
	 * the last move landed. The opening pose is 1, move 1 about to begin.
	 */
	enginePosition: number;
}

/** Where a take is at one media time, and where its performance ends. */
export interface TakeSample {
	/** Arrival position: 0 the opening pose, k move k's landing. */
	arrival: number;
	/** The last landing of the section in effect; null when it runs on. */
	endArrival: number | null;
}

export interface TakeSampleOptions {
	/**
	 * Before the section's first landing, keep its opening tempo running back
	 * in time instead of holding the opening pose: the arrival goes negative
	 * and reaches 0 on beat one. A tunnel over the footage before beat one
	 * counts down into it this way.
	 */
	leadIn?: boolean;
}

/**
 * The tempos a take can be typed at. A take's BPM never drives the engine -
 * the map does - so it has its own range rather than the playback limits.
 * A part cut from a fitted grid keeps that grid's exact tempo, which a slow
 * or fast performance can take past these.
 */
export const TAKE_MIN_BPM = 20;
export const TAKE_MAX_BPM = 300;
