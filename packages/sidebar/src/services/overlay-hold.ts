/**
 * Overlay Hold Arbitration
 *
 * The hover-expand rail has two independent close paths — the nav's own
 * `pointerleave` and the global pointermove backstop that covers leaves
 * swallowed by a `::view-transition` overlay. If they disagree about what
 * keeps the overlay open, the rail hangs open in whichever path is stricter.
 * One predicate, every caller.
 */

export interface OverlayHoldState {
  /** Pointer is over the sidebar box. */
  pointerInside: boolean;
  /** A KEYBOARD focus lives inside the sidebar (see isKeyboardFocus). */
  keyboardFocusInside: boolean;
  /** Host guard: an anchored popover/context menu is showing. */
  heldOpen: boolean;
}

export function shouldStayOpen(state: OverlayHoldState): boolean {
  return state.pointerInside || state.keyboardFocusInside || state.heldOpen;
}

/**
 * Did this focus come from the keyboard?
 *
 * Clicking a nav button focuses it too, and counting that as "keep the overlay
 * open" is what left the rail stuck open after a tab click: the pointer had
 * already left, but the lingering click-focus blocked every close path until an
 * unrelated click blurred the button. The pointer governs the pointer case;
 * only keyboard focus needs a hold of its own.
 *
 * `:focus-visible` is the platform's own keyboard-vs-pointer heuristic, so the
 * hold matches what the user actually sees (a focus ring). Non-element targets
 * and engines without `:focus-visible` fall back to holding open — failing
 * toward keyboard accessibility rather than against it.
 */
export function isKeyboardFocus(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || typeof el.matches !== 'function') return true;
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}
