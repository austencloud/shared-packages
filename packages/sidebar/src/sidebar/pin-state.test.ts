import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readPinState, writePinState } from './pin-state';

describe('pin-state', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  it('returns the fallback when no key is stored', () => {
    expect(readPinState('sk', true)).toBe(true);
    expect(readPinState('sk', false)).toBe(false);
  });

  it('round-trips a written value', () => {
    writePinState('sk', true);
    expect(readPinState('sk', false)).toBe(true);
    writePinState('sk', false);
    expect(readPinState('sk', true)).toBe(false);
  });

  it('is a no-op when key is null', () => {
    expect(() => writePinState(null, true)).not.toThrow();
    expect(readPinState(null, true)).toBe(true);
    expect(readPinState(null, false)).toBe(false);
  });
});
