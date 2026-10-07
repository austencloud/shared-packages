/**
 * Formats a time in seconds as m:ss.mmm for timeline labels and status text.
 * Negative input clamps to zero. Milliseconds that round up to a full second
 * carry into the seconds field, so 59.9996 reads 1:00.000 and never 0:60.000.
 */
export function formatTimecode(seconds: number): string {
	const total = Math.max(0, seconds);
	const minutes = Math.floor(total / 60);
	const rest = total - minutes * 60;
	const whole = Math.floor(rest);
	const millis = Math.round((rest - whole) * 1000);
	if (millis === 1000) return formatTimecode(minutes * 60 + whole + 1);
	return `${minutes}:${String(whole).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
