import { untrack } from "svelte";

/**
 * Hosts compare `runtimeProbe.untrack` with their own `untrack` import. Equal
 * references mean one Svelte runtime serves both the host and this package;
 * a second copy breaks reactivity and lifecycle calls silently.
 */
export const runtimeProbe = { untrack };
