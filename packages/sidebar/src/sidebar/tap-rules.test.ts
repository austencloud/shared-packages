import { describe, it, expect } from 'vitest';
import { isModifiedClick, moduleTapAction, visibleSections } from './tap-rules';

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('moduleTapAction', () => {
  it('navigates from the rail even when the module has sections', () => {
    expect(
      moduleTapAction({ visuallyExpanded: false, hasSections: true, isLink: true, modified: false })
    ).toBe('navigate');
  });

  it('peeks instead of following a link row in the expanded tree', () => {
    expect(
      moduleTapAction({ visuallyExpanded: true, hasSections: true, isLink: true, modified: false })
    ).toBe('peek');
  });

  it('navigates a module without sections in either state', () => {
    for (const visuallyExpanded of [true, false]) {
      expect(
        moduleTapAction({ visuallyExpanded, hasSections: false, isLink: true, modified: false })
      ).toBe('navigate');
    }
  });

  it('leaves a modified click on a link row to the browser', () => {
    expect(
      moduleTapAction({ visuallyExpanded: true, hasSections: true, isLink: true, modified: true })
    ).toBe('browser');
  });

  it('ignores modifiers on a button row', () => {
    expect(
      moduleTapAction({ visuallyExpanded: true, hasSections: true, isLink: false, modified: true })
    ).toBe('peek');
  });
});

describe('isModifiedClick', () => {
  it('treats a plain primary click as unmodified', () => {
    expect(isModifiedClick(plain)).toBe(false);
  });

  it('flags modifier keys and non-primary buttons', () => {
    expect(isModifiedClick({ ...plain, metaKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, shiftKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, altKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
  });
});

describe('visibleSections', () => {
  const sections = [
    { id: 'a', icon: '<i></i>' },
    { id: 'b' },
    { id: 'c', icon: '' },
  ];

  it('keeps every section in the expanded tree', () => {
    expect(visibleSections(sections, false).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('skips label-only sections in the rail', () => {
    expect(visibleSections(sections, true).map((s) => s.id)).toEqual(['a']);
  });
});
