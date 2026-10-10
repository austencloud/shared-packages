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
  if (target !== undefined) Object.defineProperty(event, "target", { value: target });
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

describe("isEditableTarget", () => {
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
