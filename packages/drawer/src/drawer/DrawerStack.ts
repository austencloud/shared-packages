/**
 * DrawerStack - Manages z-index stacking for nested drawers
 *
 * When multiple drawers are open simultaneously, this ensures proper
 * z-index ordering so newer drawers appear on top of older ones.
 *
 * Also manages pull-to-refresh blocking when drawers are open.
 */

const drawerStack: string[] = [];
const dismissCallbacks = new Map<string, () => void>();

let baseZIndex = 200;
const Z_INDEX_INCREMENT = 10;

/**
 * Configure the drawer stack's base z-index.
 * Call this once at app startup if you need a different base.
 */
export function configureDrawerStack(options: { baseZIndex?: number }): void {
	if (options.baseZIndex !== undefined) {
		baseZIndex = options.baseZIndex;
	}
}

/**
 * Update pull-to-refresh blocking based on drawer state.
 */
function updatePullToRefreshBlocking(): void {
	if (typeof document === 'undefined') return;

	const html = document.documentElement;

	if (drawerStack.length > 0) {
		html.style.overscrollBehaviorY = 'contain';
	} else {
		html.style.removeProperty('overscroll-behavior-y');
	}
}

/**
 * Generate a unique ID for a drawer instance
 */
export function generateDrawerId(): string {
	return `drawer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Register a drawer as open and get its z-index
 */
export function registerDrawer(id: string, onDismiss?: () => void): number {
	const existingIndex = drawerStack.indexOf(id);
	if (existingIndex !== -1) {
		drawerStack.splice(existingIndex, 1);
		dismissCallbacks.delete(id);
	}

	drawerStack.push(id);

	if (onDismiss) {
		dismissCallbacks.set(id, onDismiss);
	}

	const zIndex = baseZIndex + (drawerStack.length - 1) * Z_INDEX_INCREMENT;
	updatePullToRefreshBlocking();

	return zIndex;
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
	updatePullToRefreshBlocking();
}

/**
 * Dismiss the topmost drawer in the stack.
 */
export function dismissTopDrawer(): boolean {
	if (drawerStack.length === 0) return false;

	const topDrawerId = drawerStack[drawerStack.length - 1]!;
	const dismissCallback = dismissCallbacks.get(topDrawerId);

	if (dismissCallback) {
		dismissCallback();
		return true;
	}

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
	if (index === -1) return baseZIndex;
	return baseZIndex + index * Z_INDEX_INCREMENT;
}

/**
 * Check if any drawer is currently open
 */
export function hasOpenDrawers(): boolean {
	return drawerStack.length > 0;
}
