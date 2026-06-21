/**
 * Smooth, deterministic lateral wander offset.
 * Sum of two incommensurate sines so the signal is continuous and bounded by
 * `amp` (weights sum to 1). Replaces uncorrelated per-frame Math.random()
 * jitter, which caused visible twitching.
 *
 * @param seed     per-fish constant (phase offset) so fish don't sync
 * @param t        animation time in seconds
 * @param freq     base frequency (Hz-ish)
 * @param amp      max absolute offset in pixels
 */
export function wanderOffset(
  seed: number,
  t: number,
  freq: number,
  amp: number
): number {
  const a = Math.sin(t * freq + seed);
  const b = Math.sin(t * freq * 2.137 + seed * 1.7);
  return amp * (0.6 * a + 0.4 * b);
}
