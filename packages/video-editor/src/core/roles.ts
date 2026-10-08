import { MOVE_START_SHARE } from "./tunnel-hook.js";

/**
 * The painted titles layer's role, and the shape of the look its painter draws
 * the words with. The titles plan and its timing belong to the plugin that
 * defines a titles kind.
 */

/** Painted layers of titles clips carry this prefix and the clip's id. */
export const TITLES_ROLE_PREFIX = "titles:";

export function titlesRole(itemId: string): string {
	return `${TITLES_ROLE_PREFIX}${itemId}`;
}

export function itemIdFromTitlesRole(role: string): string | null {
	return role.startsWith(TITLES_ROLE_PREFIX) ? role.slice(TITLES_ROLE_PREFIX.length) : null;
}

/**
 * Share of the opening tunnel a titles clip over it spans: the words start to
 * lift as the tunnel starts to leave the frame and are gone partway into its
 * move, before it settles into its box.
 */
export const OPENING_TITLES_SHARE = MOVE_START_SHARE + 0.23;

/** How far, as a share of the frame's height, a word rises as it arrives and leaves. */
export const TUNNEL_TITLE_RISE = { in: 0.012, out: 0.03 } as const;

export interface TunnelWordLook {
	opacity: number;
	/** Share of the frame's height to draw it higher than its place. */
	rise: number;
}

export interface TunnelTitlesLook {
	name: TunnelWordLook;
	spoken: TunnelWordLook;
}
