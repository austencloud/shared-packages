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
  if (!Number.isFinite(limit) || limit < 0) {
    throw new RangeError("createHistory: limit must be a finite number of 0 or more, got " + String(limit));
  }
  let undoStack: Command[] = [];
  let redoStack: Command[] = [];
  let pending = 0;
  let lastMessage: string | null = null;
  let lastAction: HistoryAction | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  // Bumped by clear(). Work queued before a clear never touches the stacks afterwards.
  let generation = 0;
  // True only while the newest undo entry came from a run with nothing since
  // that moved the stacks (an undo, a redo or a clear). Gates coalescing.
  let lastWasRun = false;
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
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        // One bad listener must not stop the others or break the history; surface it asynchronously.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
  }

  /** Remove a command from a stack by identity. Returns whether it was there. */
  function remove(stack: Command[], command: Command): boolean {
    const index = stack.lastIndexOf(command);
    if (index === -1) return false;
    stack.splice(index, 1);
    return true;
  }

  /**
   * Put a command on the undo stack, folding it into the top entry when they
   * coalesce. A merge that throws leaves the command as its own entry: it has
   * already been applied, so it must stay undoable.
   */
  function push(command: Command) {
    const top = undoStack.at(-1);
    if (lastWasRun && top && command.coalesceKey !== undefined && top.coalesceKey === command.coalesceKey && top.merge) {
      let merged: Command | null | undefined;
      let ok = true;
      try {
        merged = top.merge(command);
      } catch {
        ok = false;
      }
      if (ok) {
        if (merged) undoStack[undoStack.length - 1] = merged;
        else undoStack.pop();
        redoStack = [];
        return;
      }
    }
    undoStack.push(command);
    if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
    redoStack = [];
  }

  /**
   * Queue work after everything queued before it. Publishes busy at once and
   * again when the work settles. The work gets the generation it was queued in.
   */
  function enqueue<T>(work: (queuedGeneration: number) => Promise<T>): Promise<T> {
    const queuedGeneration = generation;
    pending += 1;
    publish();
    const result = queue
      .then(() => work(queuedGeneration))
      .finally(() => {
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
   * throw calls neither, so the stacks stay as they were. If clear() ran since
   * the work was queued, neither is called and the state is left alone: the
   * result still reports what the command did, but the stacks and the last
   * message belong to whoever came after the clear.
   */
  async function perform(
    kind: HistoryAction["kind"],
    command: Command,
    queuedGeneration: number,
    act: () => Promise<Outcome> | Outcome,
    onApplied: () => void,
    onSkipped: () => void
  ): Promise<RunResult> {
    let outcome: Outcome;
    try {
      outcome = await act();
    } catch (error) {
      if (queuedGeneration === generation) {
        lastAction = { kind, label: command.label, status: "failed" };
        lastMessage = null;
      }
      return { status: "failed", label: command.label, error };
    }
    const current = queuedGeneration === generation;
    if (outcome?.kind === "skipped") {
      if (current) {
        onSkipped();
        lastMessage = outcome.message;
        lastAction = { kind, label: command.label, status: "skipped" };
      }
      return { status: "skipped", label: command.label, message: outcome.message };
    }
    if (outcome?.kind === "partial") {
      if (current) {
        onApplied();
        lastMessage = outcome.message;
        lastAction = { kind, label: command.label, status: "partial" };
      }
      return { status: "partial", label: command.label, message: outcome.message };
    }
    if (current) {
      onApplied();
      lastMessage = null;
      lastAction = { kind, label: command.label, status: "done" };
    }
    return { status: "done", label: command.label };
  }

  return {
    get state() {
      return state;
    },

    run(command) {
      return enqueue((queuedGeneration) =>
        perform(
          "run",
          command,
          queuedGeneration,
          () => command.execute(),
          () => {
            push(command);
            lastWasRun = true;
          },
          () => {}
        )
      );
    },

    record(command) {
      push(command);
      publish();
    },

    undo() {
      return enqueue(async (queuedGeneration) => {
        if (queuedGeneration !== generation) return EMPTY;
        const command = undoStack.at(-1);
        if (!command) return EMPTY;
        lastWasRun = false;
        return perform(
          "undo",
          command,
          queuedGeneration,
          () => command.undo(),
          () => {
            // Removed by identity: a record made while the undo ran may sit on top now.
            if (remove(undoStack, command)) redoStack.push(command);
          },
          () => {
            // Nothing of it is left to take back; it would only undo to nothing again.
            remove(undoStack, command);
          }
        );
      });
    },

    redo() {
      return enqueue(async (queuedGeneration) => {
        if (queuedGeneration !== generation) return EMPTY;
        const command = redoStack.at(-1);
        if (!command) return EMPTY;
        lastWasRun = false;
        return perform(
          "redo",
          command,
          queuedGeneration,
          () => command.execute(),
          () => {
            // It ran, so it is undoable again even if a record emptied the redo stack meanwhile.
            remove(redoStack, command);
            undoStack.push(command);
          },
          () => {
            remove(redoStack, command);
          }
        );
      });
    },

    clear() {
      generation += 1;
      lastWasRun = false;
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
