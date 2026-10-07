/**
 * Formats a time in seconds as m:ss.mmm for timeline labels and status text.
 * Negative, NaN and infinite input clamp to zero, which is what
 * HTMLMediaElement.duration reports before metadata loads.
 */
export function formatTimecode(seconds: number): string {
	const totalMs = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : 0;
	const minutes = Math.floor(totalMs / 60_000);
	const whole = Math.floor((totalMs % 60_000) / 1000);
	const millis = totalMs % 1000;
	return `${minutes}:${String(whole).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
