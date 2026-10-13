// Shared shapes for @austencloud/undo. No runtime code lives here.

/**
 * What a command's execute or undo reports. `undefined` means everything it
 * meant to change did change. `partial` means some of it did (the entry stays
 * and later undo/redo cover only the part that applied). `skipped` means none
 * of it did because the world moved on; nothing is recorded or kept.
 * Throwing means the write itself failed; the entry is left where it was so
 * the person can retry.
 */
export type Outcome = void | { kind: "partial" | "skipped"; message: string };

export interface Command {
  /** Names the change for the Undo and Redo buttons: "Add Fire to 12 photos". */
  label: string;
  execute(): Promise<Outcome> | Outcome;
  undo(): Promise<Outcome> | Outcome;
  /**
   * Commands sharing a key fold into one history entry while they arrive back
   * to back (every item painted in one drag). Only the entry on top of the
   * undo stack merges, and only when the newest thing the history did was a
   * run: after an undo, a redo or a clear the next command starts a new entry.
   * If merge throws, the command is kept as its own entry.
   */
  coalesceKey?: string;
  /**
   * Fold `next` into this command when both share a coalesceKey. Returns the
   * merged command, or null when the two cancel out and the entry should go.
   * It runs at the press, before either command's work has settled (`next`
   * has not executed yet, and this one may still be writing). Each part still
   * executes as its own queued run; the merged command's `execute` is only
   * called for a redo.
   */
  merge?(next: Command): Command | null;
  /**
   * Put the effect of the coming execute or undo on screen, synchronously.
   * The history calls it at the press (run, undo, redo), before the queued
   * work starts, so the screen changes on the same frame as the click or key.
   * When the work settles, the command's own write path corrects anything that
   * turned out differently. A throw is surfaced asynchronously and does not
   * stop the press. Commands without it change nothing on screen until their
   * work runs.
   */
  preview?(direction: "execute" | "undo"): void;
  /**
   * Called when a step of this command failed (or its first run applied
   * nothing) while later presses of it were still queued. The history skips
   * those later steps without calling the command, so their previews will
   * never be committed. Drop any previews still waiting, and put the screen
   * back to what the failed step actually left in the store. A throw is
   * surfaced asynchronously.
   */
  reconcile?(): void;
  /**
   * Called synchronously inside clear() for every command with presses still
   * queued. Those presses will never run, so drop any previews still waiting
   * and touch nothing on screen: after a clear the screen belongs to whatever
   * came next (another account or document). A throw is surfaced
   * asynchronously.
   */
  discardPreviews?(): void;
}

export type RunStatus = "done" | "partial" | "skipped" | "failed" | "empty";

export interface RunResult {
  status: RunStatus;
  /** The command's label, or null when there was nothing to undo or redo. */
  label: string | null;
  /** The command's message for partial and skipped outcomes. */
  message?: string;
  /** What the command threw, for failed outcomes. */
  error?: unknown;
}

export interface HistoryAction {
  kind: "run" | "undo" | "redo";
  label: string;
  /**
   * How it went. `pending` is set the moment an undo or redo is pressed,
   * before its write settles; show it like `done` ("Undone: X"). A settle
   * replaces it, unless a newer press has happened since: a late `done` is
   * then dropped, while `partial`, `skipped` and `failed` always surface.
   */
  status: Exclude<RunStatus, "empty"> | "pending";
}

export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Label of the entry Undo would take back, or null. */
  readonly undoLabel: string | null;
  /** Label of the entry Redo would bring back, or null. */
  readonly redoLabel: string | null;
  /** A command is queued or running. */
  readonly busy: boolean;
  /** The message of the last partial or skipped outcome; null after a clean or failed one, and from an undo or redo press. */
  readonly lastMessage: string | null;
  /** The last thing the history did and how it went. */
  readonly lastAction: HistoryAction | null;
}

/**
 * The stacks move at the press: `run` puts the command on the undo stack,
 * `undo` and `redo` move the top entry across, all before the call returns,
 * so canUndo, canRedo, the labels and `lastAction` are right on the same
 * frame. The work itself is queued and runs one step at a time, in press
 * order. When a step settles it only corrects what turned out differently: a
 * run that was skipped or threw is removed, an undo or redo that threw is
 * moved back, one that was skipped is dropped. A step that fails cancels every
 * later step of the same entry still queued behind it.
 */
export interface History {
  /** An immutable snapshot; a new object after every change. */
  readonly state: HistoryState;
  /**
   * Keep the command for undo at once and queue its execute. If the execute
   * is skipped or throws, the entry is removed again. Never rejects.
   */
  run(command: Command): Promise<RunResult>;
  /** Keep a command that has already been applied, without executing it. */
  record(command: Command): void;
  /**
   * Move the newest entry to the redo stack at once and queue its undo. Never
   * rejects; `status: "empty"` right away, with nothing queued, when there is none.
   */
  undo(): Promise<RunResult>;
  /**
   * Move the newest undone entry back to the undo stack at once and queue its
   * execute. Never rejects; `status: "empty"` right away when there is none.
   */
  redo(): Promise<RunResult>;
  /** Forget everything, including the last message and action. */
  clear(): void;
  /** Called with the new state after every change. Returns the unsubscribe function. */
  subscribe(listener: (state: HistoryState) => void): () => void;
}

export interface HistoryOptions {
  /** How many entries the undo stack keeps. Default 100. */
  limit?: number;
}
