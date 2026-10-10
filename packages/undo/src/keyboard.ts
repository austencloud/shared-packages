// Keyboard binding for a History: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z and
// Ctrl/Cmd+Y redo. It never fires inside text fields, never on key repeat, and
// never on an event something else has already handled, so a page's own undo
// (bound closer to the element, or earlier on the same target) wins by calling
// preventDefault.

import type { History, RunResult } from "./types.js";

export interface UndoKeyboardOptions {
  /** Where to listen. Defaults to `document`. */
  target?: EventTarget;
  /** Targets whose keystrokes belong to them; defaults to isEditableTarget. */
  isEditable?: (target: EventTarget | null) => boolean;
  /** Called with the outcome of each undo or redo the binding triggered. */
  onResult?: (kind: "undo" | "redo", result: RunResult) => void;
}

/** True for inputs, textareas, selects and contenteditable elements. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true;
}

/** Which action a keydown asks for, or null. */
export function chord(event: KeyboardEvent): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";
  return null;
}

/** Bind the chords to `history`. Returns the function that unbinds them. */
export function attachUndoKeyboard(history: History, options: UndoKeyboardOptions = {}): () => void {
  const target = options.target ?? document;
  const isEditable = options.isEditable ?? isEditableTarget;
  const handler = (raw: Event) => {
    const event = raw as KeyboardEvent;
    if (event.defaultPrevented || event.repeat) return;
    const action = chord(event);
    if (!action) return;
    if (isEditable(event.target)) return;
    if (action === "undo" ? !history.state.canUndo : !history.state.canRedo) return;
    event.preventDefault();
    void history[action]().then((result) => options.onResult?.(action, result));
  };
  target.addEventListener("keydown", handler);
  return () => target.removeEventListener("keydown", handler);
}
