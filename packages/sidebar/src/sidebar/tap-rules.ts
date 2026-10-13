import type { Section } from '../types';

/** What a tap on a module row should do. */
export type ModuleTapAction =
  /** Leave the click to the browser (modified click on a link row). */
  | 'browser'
  /** Fire onModuleChange; a link row's own anchor does the navigating. */
  | 'navigate'
  /** Toggle the module's section list; a link row's href is suppressed. */
  | 'peek';

/**
 * The module-row tap rule. Rail tap or a module with no sections navigates;
 * an expanded tap on a module with sections peeks (tabs are the navigators, so
 * navigating there would yank the overlay shut mid-browse). A modified click
 * (new tab, new window, download) on a link row belongs to the browser.
 */
export function moduleTapAction(opts: {
  visuallyExpanded: boolean;
  hasSections: boolean;
  isLink: boolean;
  modified: boolean;
}): ModuleTapAction {
  if (opts.isLink && opts.modified) return 'browser';
  if (!opts.visuallyExpanded || !opts.hasSections) return 'navigate';
  return 'peek';
}

/** A click the browser owns on a link: anything but a plain primary click. */
export function isModifiedClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/**
 * The sections a module shows in its current state. The rail shows icons only,
 * so a label-only section (no icon) is a row of the expanded tree and is
 * skipped while collapsed.
 */
export function visibleSections<T extends Pick<Section, 'icon'>>(
  sections: T[],
  isCollapsed: boolean
): T[] {
  return isCollapsed ? sections.filter((s) => !!s.icon) : sections;
}
