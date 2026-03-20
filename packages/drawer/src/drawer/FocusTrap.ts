/**
 * FocusTrap - Manages focus trapping within modal elements
 *
 * Traps keyboard focus inside a container element, preventing Tab navigation
 * from escaping. Essential for WAI-ARIA compliant modal dialogs.
 *
 * Features:
 * - Traps Tab and Shift+Tab within container
 * - Handles dynamic content (recalculates focusable elements)
 * - Stores and restores previous focus on deactivate
 * - Marks background content as inert
 */

import type { FocusTrapOptions } from '../types.js';

/**
 * Default CSS class names excluded from the inert attribute.
 * The drawer overlay is always excluded; consuming apps can add more
 * via the `inertExclusions` prop on Drawer.
 */
export const DEFAULT_INERT_EXCLUSIONS: readonly string[] = ['drawer-overlay'];

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'area[href]',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'button:not([disabled])',
	'iframe',
	'object',
	'embed',
	'[contenteditable]',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

export class FocusTrap {
	private container: HTMLElement | null = null;
	private previouslyFocused: HTMLElement | null = null;
	private inertElements: HTMLElement[] = [];
	private isActive = false;
	private handleKeydownBound: ((e: KeyboardEvent) => void) | null = null;

	constructor(private options: FocusTrapOptions = {}) {
		this.options = {
			returnFocusOnDeactivate: true,
			setInertOnSiblings: true,
			inertExclusions: DEFAULT_INERT_EXCLUSIONS,
			...options
		};
	}

	activate(container: HTMLElement) {
		if (this.isActive) {
			this.deactivate();
		}

		this.container = container;
		this.isActive = true;
		this.previouslyFocused = document.activeElement as HTMLElement | null;

		this.handleKeydownBound = this.handleKeydown.bind(this);
		document.addEventListener('keydown', this.handleKeydownBound);

		if (this.options.setInertOnSiblings) {
			this.setInertOnSiblings(true);
		}

		this.focusInitialElement();
	}

	deactivate() {
		if (!this.isActive) return;

		this.isActive = false;

		if (this.handleKeydownBound) {
			document.removeEventListener('keydown', this.handleKeydownBound);
			this.handleKeydownBound = null;
		}

		if (this.options.setInertOnSiblings) {
			this.setInertOnSiblings(false);
		}

		if (this.options.returnFocusOnDeactivate && this.previouslyFocused) {
			setTimeout(() => {
				if (this.previouslyFocused && document.body.contains(this.previouslyFocused)) {
					this.previouslyFocused.focus();
				}
			}, 0);
		}

		this.container = null;
		this.previouslyFocused = null;
	}

	updateOptions(options: Partial<FocusTrapOptions>) {
		this.options = { ...this.options, ...options };
	}

	getIsActive(): boolean {
		return this.isActive;
	}

	private getFocusableElements(): HTMLElement[] {
		if (!this.container) return [];

		const elements = Array.from(
			this.container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
		);

		return elements.filter((el) => {
			const style = window.getComputedStyle(el);
			return (
				style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
			);
		});
	}

	private focusInitialElement() {
		if (this.options.initialFocus && this.container?.contains(this.options.initialFocus)) {
			this.options.initialFocus.focus();
			return;
		}

		const focusable = this.getFocusableElements();
		if (focusable.length > 0) {
			focusable[0]!.focus();
		} else if (this.container) {
			if (!this.container.hasAttribute('tabindex')) {
				this.container.setAttribute('tabindex', '-1');
			}
			this.container.focus();
		}
	}

	private handleKeydown(event: KeyboardEvent) {
		if (!this.isActive || !this.container) return;

		if (event.key !== 'Tab') return;

		const focusable = this.getFocusableElements();
		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}

		const firstFocusable = focusable[0]!;
		const lastFocusable = focusable[focusable.length - 1]!;
		const activeElement = document.activeElement;

		if (event.shiftKey) {
			if (activeElement === firstFocusable || !this.container.contains(activeElement)) {
				event.preventDefault();
				lastFocusable.focus();
			}
		} else {
			if (activeElement === lastFocusable || !this.container.contains(activeElement)) {
				event.preventDefault();
				firstFocusable.focus();
			}
		}
	}

	private shouldExcludeFromInert(element: HTMLElement): boolean {
		const exclusions = this.options.inertExclusions ?? DEFAULT_INERT_EXCLUSIONS;
		return exclusions.some((className) => element.classList.contains(className));
	}

	private setInertOnSiblings(inert: boolean) {
		if (!this.container) return;

		if (inert) {
			this.inertElements = [];
			let current: HTMLElement | null = this.container;

			while (current && current !== document.body) {
				const parent: HTMLElement | null = current.parentElement;
				if (parent) {
					const currentElement = current;
					Array.from(parent.children).forEach((sibling) => {
						if (sibling !== currentElement && sibling instanceof HTMLElement) {
							if (this.shouldExcludeFromInert(sibling)) return;
							if (!sibling.hasAttribute('inert')) {
								sibling.setAttribute('inert', '');
								this.inertElements.push(sibling);
							}
						}
					});
				}
				current = parent;
			}
		} else {
			this.inertElements.forEach((el) => {
				el.removeAttribute('inert');
			});
			this.inertElements = [];
		}
	}
}
