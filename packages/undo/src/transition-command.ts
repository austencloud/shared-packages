// A command built from per-item before/after values. The store it writes
// through is guarded: a value is only replaced where the store still holds what
// the command expects, so a change made in another window is left alone and
// reported instead of overwritten.

import type { Command, Outcome } from "./types.js";

export interface Transition<V> {
  id: string;
  before: V;
  after: V;
}

/** One guarded write: set `next` where the store still holds `expected`. */
export interface TransitionChange<V> {
  id: string;
  expected: V;
  next: V;
}

export type TransitionResult<V> =
  | { id: string; status: "applied" }
  /** The store held something else. `current` is what it holds, or undefined when the item is gone. */
  | { id: string; status: "stale"; current: V | undefined }
  /** The write itself failed; nothing is known about the stored value. */
  | { id: string; status: "failed"; error?: unknown };

export interface TransitionStore<V> {
  /** Apply every change whose expected value still matches. Resolve one result per change. */
  commit(changes: TransitionChange<V>[]): Promise<TransitionResult<V>[]>;
}

export interface TransitionReport<V> {
  direction: "execute" | "undo";
  total: number;
  applied: number;
  stale: number;
  failed: number;
  results: TransitionResult<V>[];
}

export interface TransitionCommandOptions<V> {
  label: string;
  transitions: Transition<V>[];
  store: TransitionStore<V>;
  /** Words for a partial, skipped or failed outcome, in the app's own voice. */
  describe: (report: TransitionReport<V>) => string;
  /** Commands with the same key that arrive back to back fold into one entry. */
  coalesceKey?: string;
  /** The label of a merged entry. Without it the newer command's label wins. */
  relabel?: (merged: readonly Transition<V>[]) => string;
  /** Value equality; Object.is by default. Pass a set comparison for tag lists. */
  equals?: (a: V, b: V) => boolean;
}

export interface TransitionCommandHandle<V> extends Command {
  /** What the command currently covers: trimmed to the applied ids after a partial outcome. */
  readonly transitions: readonly Transition<V>[];
}

const handles = new WeakSet<Command>();

export function isTransitionCommand<V = unknown>(command: Command): command is TransitionCommandHandle<V> {
  return handles.has(command);
}

export function transitionCommand<V>(options: TransitionCommandOptions<V>): TransitionCommandHandle<V> {
  const equals = options.equals ?? Object.is;
  let transitions = options.transitions.slice();

  async function apply(direction: "execute" | "undo"): Promise<Outcome> {
    const changes: TransitionChange<V>[] = transitions.map((t) =>
      direction === "execute"
        ? { id: t.id, expected: t.before, next: t.after }
        : { id: t.id, expected: t.after, next: t.before }
    );
    const results = changes.length > 0 ? await options.store.commit(changes) : [];
    const applied = results.filter((r) => r.status === "applied");
    const stale = results.filter((r) => r.status === "stale").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const report: TransitionReport<V> = {
      direction,
      total: changes.length,
      applied: applied.length,
      stale,
      failed,
      results,
    };
    if (changes.length === 0) return { kind: "skipped", message: options.describe(report) };
    if (applied.length === changes.length) return undefined;
    if (applied.length > 0) {
      const keep = new Set(applied.map((r) => r.id));
      transitions = transitions.filter((t) => keep.has(t.id));
      return { kind: "partial", message: options.describe(report) };
    }
    if (stale > 0) return { kind: "skipped", message: options.describe(report) };
    throw new Error(options.describe(report));
  }

  function merge(next: Command): Command | null {
    if (!isTransitionCommand<V>(next)) return compositeCommand(handle, next);
    const byId = new Map<string, Transition<V>>();
    for (const t of transitions) byId.set(t.id, t);
    for (const t of next.transitions) {
      const existing = byId.get(t.id);
      byId.set(t.id, existing ? { id: t.id, before: existing.before, after: t.after } : t);
    }
    const merged = [...byId.values()].filter((t) => !equals(t.before, t.after));
    if (merged.length === 0) return null;
    return transitionCommand<V>({
      ...options,
      transitions: merged,
      label: options.relabel ? options.relabel(merged) : next.label,
    });
  }

  const handle: TransitionCommandHandle<V> = {
    label: options.label,
    coalesceKey: options.coalesceKey,
    execute: () => apply("execute"),
    undo: () => apply("undo"),
    merge,
    get transitions() {
      return transitions;
    },
  };
  handles.add(handle);
  return handle;
}

/** Two unrelated commands under one entry: execute in order, undo in reverse. */
function compositeCommand(first: Command, second: Command): Command {
  return {
    label: second.label,
    coalesceKey: first.coalesceKey,
    async execute() {
      return combine(await first.execute(), await second.execute());
    },
    async undo() {
      const b = await second.undo();
      const a = await first.undo();
      return combine(a, b);
    },
  };
}

function combine(a: Outcome, b: Outcome): Outcome {
  if (!a && !b) return undefined;
  const message = [a?.message, b?.message].filter(Boolean).join(" ");
  if (a?.kind === "skipped" && b?.kind === "skipped") return { kind: "skipped", message };
  return { kind: "partial", message };
}
