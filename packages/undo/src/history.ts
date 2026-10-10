// The undo/redo stack. The stacks move at the press, so the Undo bar and the
// screen answer on the same frame as the click or key. The work behind each
// press is queued on one promise chain, so writes never interleave and a slow
// write cannot be overtaken by a press made after it. When a step settles it
// only corrects what turned out differently. Nothing here knows about tags or
// Firestore.

import { isTransitionCommand } from "./transition-command.js";
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

type SettledStatus = Exclude<HistoryAction["status"], "pending">;

interface Corrections {
  /** The step reported skipped: none of it applied. */
  skipped(): void;
  /** The step threw: the write failed. */
  failed(): void;
}

export function createHistory(options: HistoryOptions = {}): History {
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError("createHistory: limit must be a whole number of 0 or more, got " + String(limit));
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
  // Bumped whenever a new entry clears the redo stack (run, record). A redo
  // that fails after that must not come back: a newer change owns the future.
  let redoEpoch = 0;
  // Bumped by every run, undo and redo press. A settle may replace lastAction
  // with a plain "done" only while no newer press has happened.
  let pressToken = 0;
  // Runs whose execute applied nothing (skipped or threw). Their queued undo
  // and redo steps do not run: there is nothing of them to take back or bring back.
  const dropped = new WeakSet<Command>();
  // When a run folds into the top entry, which entry carries it now.
  const carriedBy = new WeakMap<Command, Command>();
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

  /** Rethrow outside the history, so a bad listener or preview cannot break it. */
  function surfaceLater(error: unknown) {
    queueMicrotask(() => {
      throw error;
    });
  }

  function publish() {
    state = snapshot();
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        // One bad listener must not stop the others or break the history; surface it asynchronously.
        surfaceLater(error);
      }
    }
  }

  function preview(command: Command, direction: "execute" | "undo") {
    if (!command.preview) return;
    try {
      command.preview(direction);
    } catch (error) {
      surfaceLater(error);
    }
  }

  /** Remove a command from a stack by identity. Returns whether it was there. */
  function remove(stack: Command[], command: Command): boolean {
    const index = stack.lastIndexOf(command);
    if (index === -1) return false;
    stack.splice(index, 1);
    return true;
  }

  function trim() {
    if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
  }

  /** Put a command back on top of the undo stack after a failed undo. */
  function pushBack(command: Command) {
    undoStack.push(command);
    trim();
    // The top is no longer the newest run's entry, so the next run must not fold into it.
    lastWasRun = false;
  }

  /**
   * Put a command on the undo stack, folding it into the top entry when they
   * coalesce. A merge that throws leaves the command as its own entry.
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
        if (merged) {
          undoStack[undoStack.length - 1] = merged;
          if (merged !== command) carriedBy.set(command, merged);
          if (merged !== top) carriedBy.set(top, merged);
        } else {
          undoStack.pop();
        }
        redoStack = [];
        redoEpoch += 1;
        return;
      }
    }
    undoStack.push(command);
    trim();
    redoStack = [];
    redoEpoch += 1;
  }

  /** The entry that now carries a run folded into it, or the command itself. */
  function carrier(command: Command): Command {
    const seen = new Set<Command>();
    let entry = command;
    while (!seen.has(entry)) {
      seen.add(entry);
      const next = carriedBy.get(entry);
      if (!next) break;
      entry = next;
    }
    return entry;
  }

  /**
   * A run applied nothing: take it off whichever stack holds it (a press-time
   * undo may have moved it to redo already).
   */
  function discard(command: Command) {
    dropped.add(command);
    const wasTop = undoStack.at(-1) === command;
    if (remove(undoStack, command) || remove(redoStack, command)) {
      if (wasTop) lastWasRun = false;
      return;
    }
    // Folded into a coalesced entry. A transition group computes its
    // transitions from its parts, so a part that applied nothing simply drops
    // out of it. Once nothing else is queued (every part has settled) and the
    // group covers nothing at all, the entry goes too, so Undo does not offer
    // a change that never happened. Other merged commands are left to their own logic.
    if (pending !== 1) return;
    const entry = carrier(command);
    if (entry === command || !isTransitionCommand(entry) || entry.transitions.length > 0) return;
    const entryWasTop = undoStack.at(-1) === entry;
    if (remove(undoStack, entry) || remove(redoStack, entry)) {
      if (entryWasTop) lastWasRun = false;
    }
  }

  /**
   * Queue work after everything queued before it. Publishes busy at once
   * (together with whatever the press changed) and again when the work
   * settles. The work gets the generation it was queued in.
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
   * Record how a settled step went. A plain done only lands while no newer
   * press has happened, so it cannot overwrite that press's pending action;
   * partial, skipped and failed always land, since the person needs to know.
   */
  function report(kind: HistoryAction["kind"], command: Command, token: number, status: SettledStatus, message: string | null) {
    if (status === "done" && token !== pressToken) return;
    lastAction = { kind, label: command.label, status };
    lastMessage = message;
  }

  /**
   * Run one command step and turn its outcome into a RunResult. Done and
   * partial need no correction (the press already moved the stacks); skipped
   * and failed call their correction. If clear() ran since the work was
   * queued, no correction runs and the state is left alone: the result still
   * reports what the command did, but the stacks and the message belong to
   * whoever came after the clear.
   */
  async function perform(
    kind: HistoryAction["kind"],
    command: Command,
    queuedGeneration: number,
    token: number,
    act: () => Promise<Outcome> | Outcome,
    corrections: Corrections
  ): Promise<RunResult> {
    let outcome: Outcome;
    try {
      outcome = await act();
    } catch (error) {
      if (queuedGeneration === generation) {
        corrections.failed();
        report(kind, command, token, "failed", null);
      }
      return { status: "failed", label: command.label, error };
    }
    const current = queuedGeneration === generation;
    if (outcome?.kind === "skipped") {
      if (current) {
        corrections.skipped();
        report(kind, command, token, "skipped", outcome.message);
      }
      return { status: "skipped", label: command.label, message: outcome.message };
    }
    if (outcome?.kind === "partial") {
      if (current) report(kind, command, token, "partial", outcome.message);
      return { status: "partial", label: command.label, message: outcome.message };
    }
    if (current) report(kind, command, token, "done", null);
    return { status: "done", label: command.label };
  }

  return {
    get state() {
      return state;
    },

    run(command) {
      pressToken += 1;
      const token = pressToken;
      push(command);
      lastWasRun = true;
      // The pressed command previews its own change, even when it folded into a group.
      preview(command, "execute");
      return enqueue(async (queuedGeneration) => {
        // Queued before a clear (a sign-out, say): do not execute at all, so nothing
        // the previous session queued can write. Same result as a cleared undo or redo.
        if (queuedGeneration !== generation) return EMPTY;
        return perform("run", command, queuedGeneration, token, () => command.execute(), {
          skipped: () => discard(command),
          failed: () => discard(command),
        });
      });
    },

    record(command) {
      push(command);
      publish();
    },

    undo() {
      const command = undoStack.at(-1);
      if (!command) return Promise.resolve(EMPTY);
      undoStack.pop();
      redoStack.push(command);
      lastWasRun = false;
      pressToken += 1;
      const token = pressToken;
      lastAction = { kind: "undo", label: command.label, status: "pending" };
      lastMessage = null;
      preview(command, "undo");
      return enqueue(async (queuedGeneration) => {
        if (queuedGeneration !== generation) return EMPTY;
        // Its run applied nothing; that run's failure is the news, not this undo.
        if (dropped.has(command)) return { status: "skipped", label: command.label };
        return perform("undo", command, queuedGeneration, token, () => command.undo(), {
          skipped: () => {
            // Nothing of it is left to redo.
            remove(redoStack, command);
          },
          failed: () => {
            // The undo did not happen, so it is still undoable: back on top of the
            // undo stack, even if a newer run cleared redo meanwhile. If a later
            // redo press already moved it back there, leave it.
            if (remove(redoStack, command) || !undoStack.includes(command)) pushBack(command);
          },
        });
      });
    },

    redo() {
      const command = redoStack.at(-1);
      if (!command) return Promise.resolve(EMPTY);
      redoStack.pop();
      undoStack.push(command);
      lastWasRun = false;
      pressToken += 1;
      const token = pressToken;
      lastAction = { kind: "redo", label: command.label, status: "pending" };
      lastMessage = null;
      preview(command, "execute");
      const epoch = redoEpoch;
      return enqueue(async (queuedGeneration) => {
        if (queuedGeneration !== generation) return EMPTY;
        if (dropped.has(command)) return { status: "skipped", label: command.label };
        return perform("redo", command, queuedGeneration, token, () => command.execute(), {
          skipped: () => {
            remove(undoStack, command);
          },
          failed: () => {
            // Back on top of redo, unless something cleared redo since: then a newer
            // change owns the future and the entry is dropped. If a later undo press
            // already moved it to redo, leave it.
            if (remove(undoStack, command) && epoch === redoEpoch) redoStack.push(command);
          },
        });
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
