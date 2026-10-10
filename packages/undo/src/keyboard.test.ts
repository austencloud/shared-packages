import { describe, expect, it, vi } from "vitest";
import { createHistory } from "./history.js";
import { attachUndoKeyboard, chord, isEditableTarget } from "./keyboard.js";
import type { Command } from "./types.js";

interface KeyInit {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  code?: string;
  keyCode?: number;
  isComposing?: boolean;
}

/** A keydown with the given modifier flags, aimed at `target` when one is given. */
function keydown(init: KeyInit, target?: unknown): KeyboardEvent {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...init,
  });
  if (target !== undefined) {
    Object.defineProperty(event, "target", { value: target, configurable: true });
    Object.defineProperty(event, "composedPath", { value: () => [target], configurable: true });
  }
  return event as unknown as KeyboardEvent;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function entry(log: string[]): Command {
  return {
    label: "A",
    execute: () => {
      log.push("do");
    },
    undo: () => {
      log.push("undo");
    },
  };
}

describe("chord", () => {
  it("maps Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y to redo, nothing else", () => {
    expect(chord(keydown({ key: "z", ctrlKey: true }))).toBe("undo");
    expect(chord(keydown({ key: "Z", metaKey: true }))).toBe("undo");
    expect(chord(keydown({ key: "z", ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(chord(keydown({ key: "y", ctrlKey: true }))).toBe("redo");
    expect(chord(keydown({ key: "y", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(chord(keydown({ key: "z" }))).toBeNull();
    expect(chord(keydown({ key: "z", ctrlKey: true, altKey: true }))).toBeNull();
    expect(chord(keydown({ key: "a", ctrlKey: true }))).toBeNull();
  });
});

describe("chord with input methods and other layouts", () => {
  it("ignores keys pressed while composing text", () => {
    expect(chord(keydown({ key: "z", ctrlKey: true, isComposing: true }))).toBeNull();
    expect(chord(keydown({ key: "Process", ctrlKey: true, keyCode: 229, code: "KeyZ" }))).toBeNull();
    expect(chord(keydown({ key: "z", ctrlKey: true, keyCode: 229 }))).toBeNull();
  });

  it("falls back to the physical key when the layout produces a non-Latin letter", () => {
    expect(chord(keydown({ key: "я", code: "KeyZ", ctrlKey: true }))).toBe("undo");
    expect(chord(keydown({ key: "я", code: "KeyZ", ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(chord(keydown({ key: "н", code: "KeyY", ctrlKey: true }))).toBe("redo");
    expect(chord(keydown({ key: "ф", code: "KeyA", ctrlKey: true }))).toBeNull();
  });

  it("trusts a Latin key over the physical key", () => {
    // Dvorak: the physical Z key types ";", which is not undo.
    expect(chord(keydown({ key: ";", code: "KeyZ", ctrlKey: true }))).toBeNull();
    expect(chord(keydown({ key: "z", code: "Semicolon", ctrlKey: true }))).toBe("undo");
    expect(chord(keydown({ key: "q", code: "KeyZ", ctrlKey: true }))).toBeNull();
  });
});

describe("isEditableTarget", () => {
  const input = (type?: string) => ({ tagName: "INPUT", type }) as unknown as EventTarget;
  const withRole = (role: string) =>
    ({ tagName: "DIV", getAttribute: (name: string) => (name === "role" ? role : null) }) as unknown as EventTarget;

  it("counts text-like inputs and inputs of a missing or unknown type", () => {
    for (const type of [undefined, "", "text", "search", "email", "url", "tel", "password", "number", "date", "datetime-local", "month", "time", "week", "bogus"]) {
      expect(isEditableTarget(input(type))).toBe(true);
    }
  });

  it("does not count range, checkbox, radio and other non-text inputs", () => {
    for (const type of ["range", "checkbox", "radio", "button", "submit", "reset", "color", "file", "RANGE"]) {
      expect(isEditableTarget(input(type))).toBe(false);
    }
  });

  it("counts elements with a text-entry role", () => {
    expect(isEditableTarget(withRole("textbox"))).toBe(true);
    expect(isEditableTarget(withRole("searchbox"))).toBe(true);
    expect(isEditableTarget(withRole("combobox"))).toBe(true);
    expect(isEditableTarget(withRole("button"))).toBe(false);
  });

  it("is true for inputs, textareas, selects and contenteditable", () => {
    expect(isEditableTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("attachUndoKeyboard", () => {
  it("undoes and redoes on the chords and claims the event", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    const detach = attachUndoKeyboard(history, { target });
    const undo = keydown({ key: "z", ctrlKey: true });
    target.dispatchEvent(undo);
    expect(undo.defaultPrevented).toBe(true);
    await settle();
    expect(log).toEqual(["do", "undo"]);
    target.dispatchEvent(keydown({ key: "z", metaKey: true, shiftKey: true }));
    await settle();
    expect(log).toEqual(["do", "undo", "do"]);
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }));
    await settle();
    target.dispatchEvent(keydown({ key: "y", ctrlKey: true }));
    await settle();
    expect(log).toEqual(["do", "undo", "do", "undo", "do"]);
    detach();
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }));
    await settle();
    expect(log).toEqual(["do", "undo", "do", "undo", "do"]);
  });

  it("leaves the event alone when there is nothing to undo or redo", async () => {
    const history = createHistory();
    const target = new EventTarget();
    attachUndoKeyboard(history, { target });
    const event = keydown({ key: "z", ctrlKey: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores repeats, handled events, and keys typed into editable targets", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    attachUndoKeyboard(history, { target });
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true, repeat: true }));
    const handled = keydown({ key: "z", ctrlKey: true });
    handled.preventDefault();
    target.dispatchEvent(handled);
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }, { tagName: "INPUT" }));
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }, { tagName: "DIV", isContentEditable: true }));
    await settle();
    expect(log).toEqual(["do"]);
  });

  it("looks through a shadow root: the first node of the composed path decides", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    attachUndoKeyboard(history, { target });
    // Retargeted to the host (a div) while the real origin is an input inside the shadow tree.
    const event = keydown({ key: "z", ctrlKey: true }, { tagName: "DIV" });
    Object.defineProperty(event, "composedPath", { value: () => [{ tagName: "INPUT" }, { tagName: "DIV" }] });
    target.dispatchEvent(event);
    await settle();
    expect(log).toEqual(["do"]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets a range slider keep its own keys out of the way: undo still fires from it", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    attachUndoKeyboard(history, { target });
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }, { tagName: "INPUT", type: "range" }));
    await settle();
    expect(log).toEqual(["do", "undo"]);
  });

  it("rethrows an onResult error on a microtask instead of leaving an unhandled rejection", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    const boom = new Error("onResult broke");
    const scheduled: Array<() => void> = [];
    const stub = vi.fn((fn: () => void) => {
      scheduled.push(fn);
    });
    vi.stubGlobal("queueMicrotask", stub);
    try {
      attachUndoKeyboard(history, {
        target,
        onResult: () => {
          throw boom;
        },
      });
      target.dispatchEvent(keydown({ key: "z", ctrlKey: true }));
      await settle();
      expect(log).toEqual(["do", "undo"]);
      expect(stub).toHaveBeenCalledTimes(1);
      expect(() => scheduled[0]()).toThrow(boom);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses a custom isEditable and reports results", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(entry(log));
    const target = new EventTarget();
    const onResult = vi.fn();
    attachUndoKeyboard(history, {
      target,
      isEditable: (t) => (t as { inMenu?: boolean } | null)?.inMenu === true,
      onResult,
    });
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }, { inMenu: true }));
    await settle();
    expect(log).toEqual(["do"]);
    target.dispatchEvent(keydown({ key: "z", ctrlKey: true }, { inMenu: false }));
    await settle();
    expect(log).toEqual(["do", "undo"]);
    expect(onResult).toHaveBeenCalledWith("undo", { status: "done", label: "A" });
  });
});
