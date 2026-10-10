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

// Input types that take no typed text: Ctrl+Z on them is the page's, not theirs.
const NON_TEXT_INPUT_TYPES = new Set([
  "range",
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "color",
  "file",
  "image",
  "hidden",
]);
const TEXT_ENTRY_ROLES = new Set(["textbox", "searchbox", "combobox"]);

/**
 * True for text-entry inputs (a missing or unknown type counts as text),
 * textareas, selects, contenteditable elements and elements whose role is
 * textbox, searchbox or combobox. Range sliders, checkboxes and buttons are not.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as {
    tagName?: string;
    isContentEditable?: boolean;
    type?: unknown;
    role?: unknown;
    getAttribute?: (name: string) => string | null;
  };
  const tag = element.tagName;
  if (tag === "INPUT") {
    const type = element.type ?? element.getAttribute?.("type");
    return !(typeof type === "string" && NON_TEXT_INPUT_TYPES.has(type.toLowerCase()));
  }
  if (tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true) return true;
  const role = element.getAttribute?.("role") ?? element.role;
  return typeof role === "string" && TEXT_ENTRY_ROLES.has(role.toLowerCase());
}

/**
 * Which action a keydown asks for, or null. Ignores keys pressed while an input
 * method is composing. A single non-ASCII character (a Cyrillic or Greek
 * layout) falls back to the physical key, so Ctrl+Z stays Ctrl+Z. An ASCII
 * key is taken as typed: on Dvorak the physical Z key types ";" and is not undo.
 */
export function chord(event: KeyboardEvent): "undo" | "redo" | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.isComposing || event.keyCode === 229) return null;
  let key = (event.key ?? "").toLowerCase();
  if (key.length === 1 && key.charCodeAt(0) > 127) {
    if (event.code === "KeyZ") key = "z";
    else if (event.code === "KeyY") key = "y";
  }
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
    // The first node of the composed path is the real origin, even inside an open shadow root.
    if (isEditable(event.composedPath?.()[0] ?? event.target)) return;
    if (action === "undo" ? !history.state.canUndo : !history.state.canRedo) return;
    event.preventDefault();
    void history[action]().then((result) => {
      try {
        options.onResult?.(action, result);
      } catch (error) {
        // Surface it as an uncaught error, not an unhandled rejection of a promise nobody holds.
        queueMicrotask(() => {
          throw error;
        });
      }
    });
  };
  target.addEventListener("keydown", handler);
  return () => target.removeEventListener("keydown", handler);
}
