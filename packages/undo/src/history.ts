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

/** One queued press: what it acts on, and whether an earlier failure cancelled it. */
interface Step {
  kind: HistoryAction["kind"];
  command: Command;
  cancelled: boolean;
}

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
  // that moved the stacks (an undo, a redo, a clear, or a merge that cancelled
  // out). Gates coalescing.
  let lastWasRun = false;
  // Bumped whenever a new entry clears the redo stack (run, record). A redo
  // that fails after that must not come back: a newer change owns the future.
  let redoEpoch = 0;
  // Bumped by every run, undo and redo press. A settle may replace lastAction
  // with a plain "done" only while no newer press has happened.
  let pressToken = 0;
  // Steps queued or running, in press order.
  const queued = new Set<Step>();
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

  /** Rethrow outside the history, so a bad listener or hook cannot break it. */
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

  /**
   * Move an entry after a step settled. If the undo top changes, it is no
   * longer the newest run's entry, so the next run must not fold into it.
   */
  function relocate(change: () => void) {
    const topBefore = undoStack.at(-1);
    change();
    if (undoStack.at(-1) !== topBefore) lastWasRun = false;
  }

  /** Take an entry off both stacks, wherever earlier presses left it. */
  function lift(command: Command) {
    remove(undoStack, command);
    remove(redoStack, command);
  }

  /**
   * Put a command on the undo stack, folding it into the top entry when they
   * coalesce. A merge that throws leaves the command as its own entry.
   * Returns whether the top entry now carries this command.
   */
  function push(command: Command): boolean {
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
        redoStack = [];
        redoEpoch += 1;
        if (merged) {
          undoStack[undoStack.length - 1] = merged;
          if (merged !== command) carriedBy.set(command, merged);
          if (merged !== top) carriedBy.set(top, merged);
          return true;
        }
        // Cancelled out: the entry below is an older gesture, so nothing may fold into it.
        undoStack.pop();
        lastWasRun = false;
        return false;
      }
    }
    undoStack.push(command);
    trim();
    redoStack = [];
    redoEpoch += 1;
    return true;
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
   * A step of this command failed (or its first run applied nothing). Every
   * later step of the same command still queued becomes a no-op, so nothing
   * commits on top of a preview the failure's correction has overwritten.
   * The command is then asked to drop those previews and re-show the truth.
   */
  function cancelLater(current: Step) {
    let cancelled = 0;
    for (const step of queued) {
      if (step !== current && step.command === current.command && !step.cancelled) {
        step.cancelled = true;
        cancelled += 1;
      }
    }
    if (cancelled > 0) reconcile(current.command);
  }

  function reconcile(command: Command) {
    if (!command.reconcile) return;
    try {
      command.reconcile();
    } catch (error) {
      surfaceLater(error);
    }
  }

  /**
   * A run applied nothing: drop it from whichever stack holds it (a press-time
   * undo or redo may have moved it), and cancel its later presses.
   */
  function discard(step: Step) {
    const command = step.command;
    const wasOnStack = undoStack.includes(command) || redoStack.includes(command);
    relocate(() => lift(command));
    cancelLater(step);
    if (wasOnStack) return;
    // Folded into a coalesced entry. A transition group computes its
    // transitions from its parts, so a part that applied nothing simply drops
    // out of it. Once no part of the group (and no press of it) is still
    // queued and the group covers nothing at all, the entry goes too, so Undo
    // does not offer a change that never happened. Other merged commands are
    // left to their own logic.
    const entry = carrier(command);
    if (entry === command || !isTransitionCommand(entry) || entry.transitions.length > 0) return;
    for (const other of queued) {
      if (other !== step && !other.cancelled && carrier(other.command) === entry) return;
    }
    relocate(() => lift(entry));
  }

  /**
   * Queue a press's step after everything queued before it. Publishes busy at
   * once (together with whatever the press changed) and again when the step
   * settles. A step queued before a clear answers empty; one cancelled by an
   * earlier failure of the same command answers skipped without running.
   */
  function enqueue(step: Step, work: (queuedGeneration: number) => Promise<RunResult>): Promise<RunResult> {
    const queuedGeneration = generation;
    queued.add(step);
    pending += 1;
    publish();
    const result = queue
      .then(async (): Promise<RunResult> => {
        if (queuedGeneration !== generation) {
          // Dropped by a clear: its press-time preview will never commit, so
          // the command drops it and re-shows the truth.
          reconcile(step.command);
          return EMPTY;
        }
        // The failure that cancelled it is the news; lastAction stays as that failure left it.
        if (step.cancelled) return { status: "skipped", label: step.command.label };
        return work(queuedGeneration);
      })
      .finally(() => {
        queued.delete(step);
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
   * Run one step and turn its outcome into a RunResult. Done and partial need
   * no correction (the press already moved the stacks); skipped and failed
   * call their correction. If clear() ran since the step was queued, no
   * correction runs and the state is left alone: the result still reports
   * what the command did, but the stacks and the message belong to whoever
   * came after the clear.
   */
  async function perform(
    step: Step,
    queuedGeneration: number,
    token: number,
    act: () => Promise<Outcome> | Outcome,
    corrections: Corrections
  ): Promise<RunResult> {
    const { kind, command } = step;
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
      if (push(command)) lastWasRun = true;
      // The pressed command previews its own change, even when it folded into a group.
      preview(command, "execute");
      const step: Step = { kind: "run", command, cancelled: false };
      // Queued before a clear (a sign-out, say), the run does not execute at all, so
      // nothing the previous session queued can write.
      return enqueue(step, (queuedGeneration) =>
        perform(step, queuedGeneration, token, () => command.execute(), {
          skipped: () => discard(step),
          failed: () => discard(step),
        })
      );
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
      const step: Step = { kind: "undo", command, cancelled: false };
      return enqueue(step, (queuedGeneration) =>
        perform(step, queuedGeneration, token, () => command.undo(), {
          skipped: () => {
            // Nothing of it is left to redo.
            relocate(() => remove(redoStack, command));
          },
          failed: () => {
            // Placed by this step alone: the undo did not happen, so the entry is
            // still undoable and goes back on top of the undo stack, wherever later
            // presses moved it, even if a newer run cleared redo meanwhile.
            relocate(() => {
              lift(command);
              undoStack.push(command);
              trim();
            });
            cancelLater(step);
          },
        })
      );
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
      const step: Step = { kind: "redo", command, cancelled: false };
      return enqueue(step, (queuedGeneration) =>
        perform(step, queuedGeneration, token, () => command.execute(), {
          skipped: () => {
            relocate(() => remove(undoStack, command));
          },
          failed: () => {
            // Placed by this step alone: back on top of redo, unless something
            // cleared redo since; then a newer change owns the future and it is dropped.
            relocate(() => {
              lift(command);
              if (epoch === redoEpoch) redoStack.push(command);
            });
            cancelLater(step);
          },
        })
      );
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
