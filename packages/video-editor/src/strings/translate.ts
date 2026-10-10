import { EN, type StringKey } from "./en.js";

export type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

/**
 * Fills {name} placeholders from params; a missing param leaves the placeholder. Only a param
 * the caller passed counts, so {constructor} or {__proto__} never reads an inherited member.
 */
export function formatString(text: string, params: Record<string, string | number> = {}): string {
	return text.replace(/[{]([a-z_]+)[}]/g, (whole, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : whole,
	);
}

export function englishString(key: StringKey, params?: Record<string, string | number>): string {
	return formatString(EN[key], params);
}

/** The host's translate, or English. */
export function translatorFor(host: { translate?: Translate }): Translate {
	return (key, params) => host.translate?.(key, params) ?? englishString(key, params);
}
