import type { Component } from 'svelte';
import type { MediaTag } from '../types.js';

export const advancedTagContext = Symbol('advanced-tag-context');

export interface AdvancedTagContext {
	Icon?: Component<{ name: string; size?: number }>;
	entityHref?: (tag: MediaTag) => string | null | undefined;
}
