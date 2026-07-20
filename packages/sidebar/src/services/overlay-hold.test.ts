import { describe, it, expect } from 'vitest';
import { shouldStayOpen, isKeyboardFocus } from './overlay-hold.js';

const base = { pointerInside: false, keyboardFocusInside: false, heldOpen: false };

describe('shouldStayOpen', () => {
  it('closes when nothing holds it', () => {
    expect(shouldStayOpen(base)).toBe(false);
  });

  it('holds while the pointer is inside', () => {
    expect(shouldStayOpen({ ...base, pointerInside: true })).toBe(true);
  });

  it('holds while a keyboard focus is inside', () => {
    expect(shouldStayOpen({ ...base, keyboardFocusInside: true })).toBe(true);
  });

  it('holds while a host guard (popover/context menu) is open', () => {
    expect(shouldStayOpen({ ...base, heldOpen: true })).toBe(true);
  });

  // The regression: clicking a tab focuses its button, the pointer leaves, and
  // nothing else is holding. Click-focus is NOT keyboardFocusInside, so the
  // overlay must close on its own instead of waiting for an outside click.
  it('closes after a tab click once the pointer leaves', () => {
    expect(shouldStayOpen({ pointerInside: false, keyboardFocusInside: false, heldOpen: false })).toBe(
      false
    );
  });
});

function stubTarget(focusVisible: boolean): EventTarget {
  return { matches: (selector: string) => selector === ':focus-visible' && focusVisible } as unknown as EventTarget;
}

describe('isKeyboardFocus', () => {
  it('is true when the element matches :focus-visible (keyboard)', () => {
    expect(isKeyboardFocus(stubTarget(true))).toBe(true);
  });

  it('is false for pointer-driven focus (no :focus-visible)', () => {
    expect(isKeyboardFocus(stubTarget(false))).toBe(false);
  });

  it('falls back to holding open for a null target', () => {
    expect(isKeyboardFocus(null)).toBe(true);
  });

  it('falls back to holding open when matches() is unavailable', () => {
    expect(isKeyboardFocus({} as EventTarget)).toBe(true);
  });

  it('falls back to holding open when :focus-visible is unsupported (throws)', () => {
    const throwing = {
      matches: () => {
        throw new SyntaxError('unsupported pseudo-class');
      },
    } as unknown as EventTarget;
    expect(isKeyboardFocus(throwing)).toBe(true);
  });
});
