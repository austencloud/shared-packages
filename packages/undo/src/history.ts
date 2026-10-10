// The undo/redo stack. Every run, undo and redo is queued on one promise
// chain, so commands never interleave and a slow write cannot be overtaken by
// a click made after it. Nothing here knows about tags or Firestore.

import type {
  Command,
  History,
  HistoryAction,
  HistoryOptions,
  HistoryState,
  Outcome,
  RunResult,
} from "./types.js";

const EMPTY: RunResult = { status: "empty", label: null };

export function createHistory(options: HistoryOptions = {}): History {
  const limit = options.limit ?? 100;
  let undoStack: Command[] = [];
  let redoStack: Command[] = [];
  let pending = 0;
  let lastMessage: string | null = null;
  let lastAction: HistoryAction | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(state: HistoryState) => void>();

  function snapshot(): HistoryState {
    return Object.freeze({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack.at(-1)?.label ?? null,
      redoLabel: redoStack.at(-1)?.label ?? null,
      busy: pending > 0,
      lastMessage,
      lastAction,
    });
  }

  let state = snapshot();

  function publish() {
    state = snapshot();
    for (const listener of listeners) listener(state);
  }

  /** Put a command on the undo stack, folding it into the top entry when they coalesce. */
  function push(command: Command) {
    const top = undoStack.at(-1);
    if (top && command.coalesceKey !== undefined && top.coalesceKey === command.coalesceKey && top.merge) {
      const merged = top.merge(command);
      if (merged) undoStack[undoStack.length - 1] = merged;
      else undoStack.pop();
    } else {
      undoStack.push(command);
      if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
    }
    redoStack = [];
  }

  /** Queue work after everything queued before it. Publishes busy at once and again when the work settles. */
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    pending += 1;
    publish();
    const result = queue.then(work).finally(() => {
      pending -= 1;
      publish();
    });
    // A failure never blocks the work queued after it (run/undo/redo never reject anyway).
    queue = result.catch(() => undefined);
    return result;
  }

  /**
   * Run one command step and turn its outcome into a RunResult. `onApplied`
   * runs for clean and partial outcomes, `onSkipped` for skipped ones; a
   * throw calls neither, so the stacks stay as they were.
   */
  async function perform(
    kind: HistoryAction["kind"],
    command: Command,
    act: () => Promise<Outcome> | Outcome,
    onApplied: () => void,
    onSkipped: () => void
  ): Promise<RunResult> {
    let outcome: Outcome;
    try {
      outcome = await act();
    } catch (error) {
      lastAction = { kind, label: command.label, status: "failed" };
      lastMessage = null;
      return { status: "failed", label: command.label, error };
    }
    if (outcome && outcome.kind === "skipped") {
      onSkipped();
      lastMessage = outcome.message;
      lastAction = { kind, label: command.label, status: "skipped" };
      return { status: "skipped", label: command.label, message: outcome.message };
    }
    onApplied();
    if (outcome) {
      lastMessage = outcome.message;
      lastAction = { kind, label: command.label, status: "partial" };
      return { status: "partial", label: command.label, message: outcome.message };
    }
    lastMessage = null;
    lastAction = { kind, label: command.label, status: "done" };
    return { status: "done", label: command.label };
  }

  return {
    get state() {
      return state;
    },

    run(command) {
      return enqueue(() =>
        perform(
          "run",
          command,
          () => command.execute(),
          () => push(command),
          () => {}
        )
      );
    },

    record(command) {
      push(command);
      publish();
    },

    undo() {
      return enqueue(async () => {
        const command = undoStack.at(-1);
        if (!command) return EMPTY;
        return perform(
          "undo",
          command,
          () => command.undo(),
          () => {
            undoStack.pop();
            redoStack.push(command);
          },
          () => {
            // Nothing of it is left to take back; it would only undo to nothing again.
            undoStack.pop();
          }
        );
      });
    },

    redo() {
      return enqueue(async () => {
        const command = redoStack.at(-1);
        if (!command) return EMPTY;
        return perform(
          "redo",
          command,
          () => command.execute(),
          () => {
            redoStack.pop();
            undoStack.push(command);
          },
          () => {
            redoStack.pop();
          }
        );
      });
    },

    clear() {
      undoStack = [];
      redoStack = [];
      lastMessage = null;
      lastAction = null;
      publish();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
