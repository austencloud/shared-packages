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
   */
  merge?(next: Command): Command | null;
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
  status: Exclude<RunStatus, "empty">;
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
  /** The message of the last partial or skipped outcome; null after a clean or failed one. */
  readonly lastMessage: string | null;
  /** The last thing the history did and how it went. */
  readonly lastAction: HistoryAction | null;
}

export interface History {
  /** An immutable snapshot; a new object after every change. */
  readonly state: HistoryState;
  /** Execute a command and, unless it was skipped or threw, keep it for undo. Never rejects. */
  run(command: Command): Promise<RunResult>;
  /** Keep a command that has already been applied, without executing it. */
  record(command: Command): void;
  /** Undo the newest entry. Never rejects; `status: "empty"` when there is none. */
  undo(): Promise<RunResult>;
  /** Redo the newest undone entry. Never rejects; `status: "empty"` when there is none. */
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
