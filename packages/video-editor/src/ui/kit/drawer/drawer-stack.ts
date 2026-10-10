/**
 * DrawerStack - Manages z-index stacking for nested drawers
 *
 * When multiple drawers are open simultaneously, this ensures proper
 * z-index ordering so newer drawers appear on top of older ones.
 *
 * Usage is automatic - the Drawer component registers/unregisters
 * itself when opening/closing.
 */

import type { EditorShortcuts } from "../../../host.js";

// Global drawer stack - tracks open drawer IDs in order
const drawerStack: string[] = [];

// Map of drawer IDs to their dismiss callbacks
const dismissCallbacks = new Map<string, () => void>();

// tka's Z.DRAWER (src/lib/shared/ui/z-index.ts).
const BASE_Z_INDEX = 400;

// The unregister each open drawer's escape layer returned, by drawer ID
const escapeUnregisters = new Map<string, () => void>();

// Z-index increment per drawer level
const Z_INDEX_INCREMENT = 10;

/**
 * Generate a unique ID for a drawer instance
 */
export function generateDrawerId(): string {
	return `drawer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Register a drawer as open and get its z-index
 * @param id - Unique drawer ID
 * @param escapeLayer - The host's escape layer registration (services.shortcuts.escapeLayer)
 * @param onDismiss - Optional callback to dismiss this drawer
 * @param canEscapeDismiss - Whether Escape may close the drawer right now
 * @returns The z-index to use for this drawer
 */
export function registerDrawer(
	id: string,
	escapeLayer: EditorShortcuts["escapeLayer"],
	onDismiss?: () => void,
	canEscapeDismiss: () => boolean = () => true,
): number {
	// Remove if already exists (shouldn't happen, but be safe)
	const existingIndex = drawerStack.indexOf(id);
	if (existingIndex !== -1) {
		drawerStack.splice(existingIndex, 1);
		dismissCallbacks.delete(id);
	}

	// Add to top of stack
	drawerStack.push(id);

	// Store dismiss callback if provided
	if (onDismiss) {
		dismissCallbacks.set(id, onDismiss);
	}

	// The host's layer has no canDismiss, so the guard sits inside the close callback.
	escapeUnregisters.get(id)?.();
	escapeUnregisters.set(
		id,
		escapeLayer(`drawer:${id}`, () => {
			if (onDismiss && canEscapeDismiss()) onDismiss();
		}),
	);

	return BASE_Z_INDEX + (drawerStack.length - 1) * Z_INDEX_INCREMENT;
}

/**
 * Unregister a drawer when it closes
 */
export function unregisterDrawer(id: string): void {
	const index = drawerStack.indexOf(id);
	if (index !== -1) {
		drawerStack.splice(index, 1);
	}
	dismissCallbacks.delete(id);
	escapeUnregisters.get(id)?.();
	escapeUnregisters.delete(id);
}

/**
 * Dismiss the topmost drawer in the stack.
 * Used when a swipe is detected on a non-top drawer (e.g., when a child drawer
 * has pointer-events: none on its backdrop, allowing touches to pass through).
 * @returns true if a drawer was dismissed, false if stack is empty
 */
export function dismissTopDrawer(): boolean {
	if (drawerStack.length === 0) {
		return false;
	}

	const topDrawerId = drawerStack[drawerStack.length - 1]!;
	const dismissCallback = dismissCallbacks.get(topDrawerId);

	if (dismissCallback) {
		dismissCallback();
		return true;
	}

	// No callback registered - drawer can't be dismissed this way
	return false;
}

/**
 * Check if a drawer is the topmost drawer
 */
export function isTopDrawer(id: string): boolean {
	return drawerStack.length > 0 && drawerStack[drawerStack.length - 1] === id;
}

/**
 * Get the current drawer stack depth
 */
export function getStackDepth(): number {
	return drawerStack.length;
}

/**
 * Get z-index for a specific drawer
 */
export function getDrawerZIndex(id: string): number {
	const index = drawerStack.indexOf(id);
	if (index === -1) {
		return BASE_Z_INDEX;
	}
	return BASE_Z_INDEX + index * Z_INDEX_INCREMENT;
}

/**
 * Check if any drawer is currently open
 */
export function hasOpenDrawers(): boolean {
	return drawerStack.length > 0;
}
