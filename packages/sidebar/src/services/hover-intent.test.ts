import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHoverIntent } from './hover-intent';

describe('createHoverIntent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires onOpen only after openDelay of sustained hover', () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    const c = createHoverIntent({ openDelay: 50, closeDelay: 300, onOpen, onClose });
    c.pointerEnter();
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(49);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('cancels a pending open if the pointer leaves before the delay', () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    const c = createHoverIntent({ openDelay: 50, closeDelay: 300, onOpen, onClose });
    c.pointerEnter();
    c.pointerLeave();
    vi.advanceTimersByTime(100);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('fires onClose only after closeDelay grace', () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    const c = createHoverIntent({ openDelay: 0, closeDelay: 300, onOpen, onClose });
    c.pointerEnter();
    vi.advanceTimersByTime(0);
    c.pointerLeave();
    vi.advanceTimersByTime(299);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('openNow / closeNow fire immediately and clear timers', () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    const c = createHoverIntent({ openDelay: 50, closeDelay: 300, onOpen, onClose });
    c.openNow();
    expect(onOpen).toHaveBeenCalledOnce();
    c.closeNow();
    expect(onClose).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('defaults openDelay to 50ms when omitted', () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    const c = createHoverIntent({ onOpen, onClose });
    c.pointerEnter();
    vi.advanceTimersByTime(49);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
