/**
 * The preset schema's BPM bounds, copied from tka's
 * animation-engine/domain/constants/timing.ts. tests/unit/video-editor-copies.test.ts
 * in tka fails if the two drift.
 */
export const PLAYBACK_BASELINE_BPM = 60;
export const PLAYBACK_MIN_SPEED = 0.1;
export const PLAYBACK_MAX_SPEED = 3.0;
export const PLAYBACK_MIN_BPM = PLAYBACK_MIN_SPEED * PLAYBACK_BASELINE_BPM;
export const PLAYBACK_MAX_BPM = PLAYBACK_MAX_SPEED * PLAYBACK_BASELINE_BPM;
