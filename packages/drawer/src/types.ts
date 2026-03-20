import type { Snippet } from 'svelte';

export type DrawerPlacement = 'bottom' | 'top' | 'right' | 'left';
export type CloseReason = 'backdrop' | 'escape' | 'programmatic';
export type SnapPointValue = number | string;

export interface DrawerProps {
	isOpen?: boolean;
	closeOnBackdrop?: boolean;
	closeOnEscape?: boolean;
	dismissible?: boolean;
	labelledBy?: string;
	ariaLabel?: string;
	describedBy?: string;
	role?: 'dialog' | 'menu' | 'listbox' | 'alertdialog';
	showHandle?: boolean;
	class?: string;
	backdropClass?: string;
	placement?: DrawerPlacement;
	/** When true, uses bottom placement on mobile regardless of specified placement */
	responsivePlacement?: boolean;
	/** matchMedia query for mobile detection (default: '(max-width: 768px)') */
	mobileBreakpoint?: string;
	// Focus trap options
	trapFocus?: boolean;
	initialFocusElement?: HTMLElement | null;
	returnFocusOnClose?: boolean;
	setInertOnSiblings?: boolean;
	/** CSS class names to exclude from the inert attribute (merged with ['drawer-overlay']) */
	inertExclusions?: string[];
	// Snap points options
	snapPoints?: SnapPointValue[] | null;
	activeSnapPoint?: number | null;
	closeOnSnapToZero?: boolean;
	// Animation options
	springAnimation?: boolean;
	scaleBackground?: boolean;
	preventScroll?: boolean;
	// Focus behavior
	autoFocus?: boolean;
	onclose?: (event: CustomEvent<{ reason: CloseReason }>) => void;
	onOpenChange?: (open: boolean) => void;
	onbackdropclick?: (event: MouseEvent) => boolean;
	onDragChange?: (offset: number, progress: number, isDragging: boolean) => void;
	onSnapPointChange?: (index: number, valuePx: number) => void;
	children?: Snippet;
}

export interface SwipeToDismissOptions {
	placement: DrawerPlacement;
	dismissible: boolean;
	onDismiss: () => void;
	/** Called during drag with current state. isDragging=true on start/move, false on end */
	onDragChange?: (offset: number, progress: number, isDragging: boolean) => void;
	/** Called when drag ends with offset, velocity (px/ms), and duration. Return true to prevent default dismiss. */
	onDragEnd?: (offset: number, velocity: number, duration: number) => boolean;
	/** Drawer ID for stack management - only top drawer responds to swipe */
	drawerId?: string;
}

export interface FocusTrapOptions {
	initialFocus?: HTMLElement | null;
	returnFocusOnDeactivate?: boolean;
	setInertOnSiblings?: boolean;
	inertExclusions?: readonly string[];
	onEscapeAttempt?: () => void;
}

export interface SnapPointsOptions {
	placement: DrawerPlacement;
	snapPoints: SnapPointValue[];
	defaultSnapPoint?: number;
	velocityThreshold?: number;
	distanceThreshold?: number;
	onSnapPointChange?: (index: number, value: number) => void;
}

export interface DrawerEffectsOptions {
	scaleBackground: boolean;
	preventScroll: boolean;
	isAnimatedOpen: boolean;
}
