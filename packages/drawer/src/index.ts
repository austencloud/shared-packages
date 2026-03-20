// Public API for @austencloud/drawer
export { default as Drawer } from './Drawer.svelte';
export { configureDrawerStack, hasOpenDrawers, getStackDepth } from './drawer/DrawerStack.js';
export { DEFAULT_INERT_EXCLUSIONS } from './drawer/FocusTrap.js';
export type {
	DrawerPlacement,
	CloseReason,
	SnapPointValue,
	DrawerProps,
	FocusTrapOptions,
	DrawerEffectsOptions
} from './types.js';
