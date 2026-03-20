<!--
  Drawer.svelte - Production drawer with pure CSS animations

  Features:
  - Slides from right, left, top, or bottom based on placement
  - Placement-aware swipe gestures (horizontal for side drawers, vertical for top/bottom)
  - Smooth CSS transitions with @starting-style entry animations
  - Native <dialog> element for proper semantics and accessibility
  - Focus trapping (WAI-ARIA compliant)
  - Inert attribute on background content
  - Snap points for multi-height drawers
  - Drawer stacking for nested drawers
  - Spring animation option
  - Background scale effect
  - Reduced motion support
  - Themeable via --drawer-* CSS custom properties
-->
<script lang="ts">
	import './drawer/Drawer.css';
	import { onMount, onDestroy, untrack, type Snippet } from 'svelte';
	import { SwipeToDismiss } from './drawer/SwipeToDismiss.js';
	import { FocusTrap, DEFAULT_INERT_EXCLUSIONS } from './drawer/FocusTrap.js';
	import { SnapPoints } from './drawer/SnapPoints.js';
	import { DrawerEffects } from './drawer/DrawerEffects.js';
	import {
		generateDrawerId,
		registerDrawer,
		unregisterDrawer,
		isTopDrawer
	} from './drawer/DrawerStack.js';
	import type { DrawerPlacement, CloseReason, SnapPointValue } from './types.js';

	let {
		isOpen = $bindable(false),
		closeOnBackdrop = true,
		closeOnEscape = true,
		dismissible = true,
		labelledBy,
		ariaLabel,
		describedBy,
		role = 'dialog',
		showHandle = true,
		class: drawerClass = '',
		backdropClass = '',
		placement = 'bottom',
		responsivePlacement = false,
		mobileBreakpoint = '(max-width: 768px)',
		// Focus trap options
		trapFocus = true,
		initialFocusElement = null,
		returnFocusOnClose = true,
		setInertOnSiblings = true,
		inertExclusions = [],
		// Snap points options
		snapPoints = null,
		activeSnapPoint = $bindable<number | null>(null),
		closeOnSnapToZero = true,
		// Animation options
		springAnimation = false,
		scaleBackground = false,
		preventScroll = true,
		// Focus behavior
		autoFocus = true,
		onclose,
		onOpenChange,
		onbackdropclick,
		onDragChange,
		onSnapPointChange,
		children
	}: {
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
		trapFocus?: boolean;
		initialFocusElement?: HTMLElement | null;
		returnFocusOnClose?: boolean;
		setInertOnSiblings?: boolean;
		/** Additional CSS class names to exclude from inert (merged with ['drawer-overlay']) */
		inertExclusions?: string[];
		snapPoints?: SnapPointValue[] | null;
		activeSnapPoint?: number | null;
		closeOnSnapToZero?: boolean;
		springAnimation?: boolean;
		scaleBackground?: boolean;
		preventScroll?: boolean;
		autoFocus?: boolean;
		onclose?: (event: CustomEvent<{ reason: CloseReason }>) => void;
		onOpenChange?: (open: boolean) => void;
		onbackdropclick?: (event: MouseEvent) => boolean;
		onDragChange?: (offset: number, progress: number, isDragging: boolean) => void;
		onSnapPointChange?: (index: number, valuePx: number) => void;
		children?: Snippet;
	} = $props();

	// Merge consumer exclusions with the package default
	const mergedExclusions = $derived([...DEFAULT_INERT_EXCLUSIONS, ...inertExclusions]);

	// Simple mobile detection (replaces TKA's responsiveLayoutManager)
	let isMobile = $state(false);
	let mounted = $state(false);
	let wasOpen = $state(false);
	let shouldRender = $state(false);
	let isAnimatedOpen = $state(false);
	let isAnimating = $state(false);
	let closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let animatingTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const prefersReducedMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

	// Drawer stack management
	const drawerId = generateDrawerId();
	let stackZIndex = $state(200);

	// Reactive state for drag visuals
	let isDragging = $state(false);
	let dragOffsetX = $state(0);
	let dragOffsetY = $state(0);

	let handlersInitialized = $state(false);

	// Compute effective placement: on mobile, bottom sheet is more natural
	const effectivePlacement = $derived.by(() => {
		if (responsivePlacement && isMobile) {
			return 'bottom';
		}
		return placement;
	});

	function handleInternalDragChange(offset: number, progress: number, dragging: boolean) {
		isDragging = dragging;
		if (effectivePlacement === 'right' || effectivePlacement === 'left') {
			dragOffsetX = offset;
			dragOffsetY = 0;
		} else {
			dragOffsetX = 0;
			dragOffsetY = offset;
		}
		onDragChange?.(offset, progress, dragging);
	}

	function handleDragEnd(offset: number, velocity: number, duration: number): boolean {
		if (!snapPointsInstance || !snapPoints || snapPoints.length === 0) {
			return false;
		}

		const targetIndex = snapPointsInstance.snapToClosest(offset, velocity, duration);
		snapPointOffset = snapPointsInstance.getTransformOffset();

		if (targetIndex === 0 && closeOnSnapToZero) {
			return false;
		}

		return true;
	}

	let drawerElement = $state<HTMLDialogElement | null>(null);
	let swipeToDismiss = $state<SwipeToDismiss | null>(null);
	let focusTrap: FocusTrap | null = null;
	let snapPointsInstance: SnapPoints | null = null;
	let snapPointOffset = $state(0);
	let currentSnapIndex = $state<number | null>(null);
	let drawerEffects: DrawerEffects | null = null;

	function initializeHandlers() {
		if (handlersInitialized) return;
		handlersInitialized = true;

		swipeToDismiss = new SwipeToDismiss({
			placement: effectivePlacement,
			dismissible,
			drawerId,
			onDismiss: () => {
				isOpen = false;
			},
			onDragChange: handleInternalDragChange,
			onDragEnd: handleDragEnd
		});

		focusTrap = new FocusTrap({
			initialFocus: initialFocusElement ?? null,
			returnFocusOnDeactivate: returnFocusOnClose,
			setInertOnSiblings: setInertOnSiblings,
			inertExclusions: mergedExclusions
		});

		drawerEffects = new DrawerEffects({
			scaleBackground,
			preventScroll,
			isAnimatedOpen: false
		});
	}

	// Update SwipeToDismiss when placement changes
	$effect(() => {
		if (!handlersInitialized) return;
		swipeToDismiss = new SwipeToDismiss({
			placement: effectivePlacement,
			dismissible,
			drawerId,
			onDismiss: () => {
				isOpen = false;
			},
			onDragChange: handleInternalDragChange,
			onDragEnd: handleDragEnd
		});
	});

	// Initialize snap points when provided
	$effect(() => {
		if (!handlersInitialized) return;
		if (snapPoints && snapPoints.length > 0) {
			snapPointsInstance = new SnapPoints({
				placement: effectivePlacement,
				snapPoints,
				defaultSnapPoint: snapPoints.length - 1,
				onSnapPointChange: (index, valuePx) => {
					currentSnapIndex = index;
					activeSnapPoint = index;
					onSnapPointChange?.(index, valuePx);
					if (index === 0 && closeOnSnapToZero) {
						isOpen = false;
					}
				}
			});
		} else {
			snapPointsInstance = null;
			snapPointOffset = 0;
			currentSnapIndex = null;
		}
	});

	// Initialize snap handler dimensions
	$effect(() => {
		if (drawerElement && snapPointsInstance && isAnimatedOpen) {
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			snapPointsInstance.initialize(viewportWidth, viewportHeight);
			snapPointOffset = snapPointsInstance.getTransformOffset();
		}
	});

	onMount(() => {
		mounted = true;

		// Simple mobile detection using configurable breakpoint
		const mql = window.matchMedia(mobileBreakpoint);
		isMobile = mql.matches;

		const handleChange = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mql.addEventListener('change', handleChange);

		return () => {
			mql.removeEventListener('change', handleChange);
		};
	});

	// Track open state changes
	$effect(() => {
		const previouslyOpen = untrack(() => wasOpen);

		if (isOpen !== previouslyOpen) {
			onOpenChange?.(isOpen);

			if (isOpen) {
				if (closeTimeoutId !== null) {
					clearTimeout(closeTimeoutId);
					closeTimeoutId = null;
				}
				if (animatingTimeoutId !== null) {
					clearTimeout(animatingTimeoutId);
					animatingTimeoutId = null;
				}

				isAnimating = true;
				initializeHandlers();

				stackZIndex = registerDrawer(drawerId, () => {
					isOpen = false;
				});
				shouldRender = true;
				swipeToDismiss?.reset();

				const completeOpen = () => {
					drawerElement?.show();
					isAnimatedOpen = true;
					if (trapFocus && drawerElement && focusTrap) {
						focusTrap.activate(drawerElement);
					} else if (autoFocus && drawerElement) {
						drawerElement.focus();
					}

					animatingTimeoutId = setTimeout(() => {
						isAnimating = false;
					}, 400);
				};

				if (prefersReducedMotion()) {
					isAnimatedOpen = true;
					isAnimating = false;
					requestAnimationFrame(completeOpen);
				} else {
					isAnimatedOpen = false;
					requestAnimationFrame(() => {
						requestAnimationFrame(completeOpen);
					});
				}
			}

			if (previouslyOpen && !isOpen) {
				emitClose('programmatic');
				isAnimatedOpen = false;
				swipeToDismiss?.reset();
				focusTrap?.deactivate();
				unregisterDrawer(drawerId);

				const completeClose = () => {
					drawerElement?.close();
					shouldRender = false;
				};

				if (prefersReducedMotion()) {
					completeClose();
				} else {
					closeTimeoutId = setTimeout(completeClose, 400);
				}
			}

			untrack(() => {
				wasOpen = isOpen;
			});
		}
	});

	function emitClose(reason: CloseReason) {
		if (onclose) {
			onclose(new CustomEvent('close', { detail: { reason } }));
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (onbackdropclick) {
			const shouldClose = onbackdropclick(event);
			if (shouldClose) {
				emitClose('backdrop');
				isOpen = false;
			}
			return;
		}

		if (closeOnBackdrop) {
			emitClose('backdrop');
			isOpen = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && closeOnEscape && isOpen && isTopDrawer(drawerId)) {
			event.preventDefault();
			emitClose('escape');
			isOpen = false;
		}
	}

	function handleDialogCancel(event: Event) {
		if (!closeOnEscape || !isTopDrawer(drawerId)) {
			event.preventDefault();
			return;
		}
		emitClose('escape');
		isOpen = false;
	}

	const dataState = $derived(isAnimatedOpen ? 'open' : 'closed');

	const overlayClasses = $derived(`drawer-overlay ${backdropClass}`.trim());

	const contentClasses = $derived(`drawer-content ${drawerClass}`.trim());

	const computedTransform = $derived.by(() => {
		if (isDragging && (dragOffsetY !== 0 || dragOffsetX !== 0)) {
			const isHorizontal = effectivePlacement === 'left' || effectivePlacement === 'right';
			if (isHorizontal) {
				return `translateX(${dragOffsetX + snapPointOffset}px)`;
			} else {
				return `translateY(${dragOffsetY + snapPointOffset}px)`;
			}
		}

		if (snapPointOffset !== 0 && isAnimatedOpen) {
			const isHorizontal = effectivePlacement === 'left' || effectivePlacement === 'right';
			if (isHorizontal) {
				return `translateX(${snapPointOffset}px)`;
			} else {
				return `translateY(${snapPointOffset}px)`;
			}
		}

		return '';
	});

	// Update focus trap options when props change
	$effect(() => {
		if (!focusTrap) return;
		focusTrap.updateOptions({
			initialFocus: initialFocusElement,
			returnFocusOnDeactivate: returnFocusOnClose,
			setInertOnSiblings: setInertOnSiblings,
			inertExclusions: mergedExclusions
		});
	});

	// Attach/detach swipe handler
	$effect(() => {
		if (drawerElement && swipeToDismiss) {
			swipeToDismiss.attach(drawerElement);
		}
		return () => {
			swipeToDismiss?.detach();
		};
	});

	// Disable swipe during animation
	$effect(() => {
		swipeToDismiss?.setDisabled(isAnimating);
	});

	// Update drawer effects
	$effect(() => {
		if (!drawerEffects) return;
		drawerEffects.update({
			scaleBackground,
			preventScroll,
			isAnimatedOpen
		});
	});

	onDestroy(() => {
		swipeToDismiss?.detach();
		focusTrap?.deactivate();
		drawerEffects?.cleanup();
		unregisterDrawer(drawerId);
		if (closeTimeoutId !== null) clearTimeout(closeTimeoutId);
		if (animatingTimeoutId !== null) clearTimeout(animatingTimeoutId);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if mounted && shouldRender}
	<!-- Backdrop -->
	<div
		class={overlayClasses}
		data-state={dataState}
		onclick={handleBackdropClick}
		aria-hidden="true"
		style:z-index={stackZIndex - 1}
	></div>

	<!-- Drawer content -->
	<dialog
		bind:this={drawerElement}
		class={contentClasses}
		class:dragging={isDragging}
		class:has-snap-points={snapPoints && snapPoints.length > 0}
		class:spring-animation={springAnimation}
		data-placement={effectivePlacement}
		data-state={dataState}
		data-snap-index={currentSnapIndex}
		data-drawer-id={drawerId}
		tabindex="-1"
		aria-modal="true"
		aria-labelledby={labelledBy}
		aria-label={ariaLabel}
		aria-describedby={describedBy}
		{role}
		oncancel={handleDialogCancel}
		oncontextmenu={(e) => {
			e.preventDefault();
			return false;
		}}
		style:z-index={stackZIndex}
		style:transform={computedTransform || undefined}
		style:transition={isDragging ? 'none' : ''}
	>
		{#if showHandle}
			<div class="drawer-handle" aria-hidden="true"></div>
		{/if}
		<div class="drawer-inner">
			{@render children?.()}
		</div>
	</dialog>
{/if}
