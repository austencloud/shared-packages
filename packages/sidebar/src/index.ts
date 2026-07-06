// Public API for @austencloud/sidebar
export { default as Sidebar } from './Sidebar.svelte';
export { default as SidebarAccount } from './SidebarAccount.svelte';
export { default as NotificationBadge } from './NotificationBadge.svelte';
export { createHoverIntent } from './services/hover-intent.js';
export type { HoverIntentOptions, HoverIntentController } from './services/hover-intent.js';
export { readPinState, writePinState } from './sidebar/pin-state.js';
export type { Section, SectionGroup, ModuleDefinition, SidebarProps } from './types.js';
