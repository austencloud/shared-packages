// A command built from per-item before/after values. The store it writes
// through is guarded: a value is only replaced where the store still holds what
// the command expects, so a change made in another window is left alone and
// reported instead of overwritten.
//
// Presses are instant: the history calls `preview` at the press, which hands
// the coming changes to `store.show` so the screen changes on the same frame.
// The guarded commit runs later, in press order, and is told whether its press
// was previewed so the store only corrects what turned out differently.

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

/** What a commit is told about the press behind it. */
export interface TransitionCommitContext {
  /** Whether this commit is a command's execute (a run or a redo) or its undo. */
  direction: "execute" | "undo";
  /**
   * The screen was already given `next` for these ids: `show` ran at the press,
   * or the caller showed the first execute itself (`shown`). The store then
   * only corrects ids that did not apply. When false, the store puts applied
   * values on screen itself, as a store without `show` always does.
   */
  previewed: boolean;
}

export interface TransitionStore<V> {
  /**
   * Apply every change whose expected value still matches. Resolve one result
   * per change, matched by id. Once any write has landed this must resolve and
   * never reject: report the writes that did not land as `failed` per change.
   * A rejection tells the command nothing about which writes landed, so it is
   * treated as a failure of the whole step and can strand the writes that did.
   * The context is optional, so a store written for 0.1 keeps working.
   */
  commit(changes: TransitionChange<V>[], context?: TransitionCommitContext): Promise<TransitionResult<V>[]>;
  /**
   * Put `next` on screen for these ids, synchronously, without writing
   * anything. Called at the press, before the commit for the same changes is
   * queued; it may also be called just before a commit for ids that press did
   * not cover. Optional: without it presses change the screen only when the
   * commit runs, and every commit is told `previewed: false` (except a first
   * execute marked `shown`).
   */
  show?(changes: TransitionChange<V>[]): void;
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
  /**
   * Commands with the same key that arrive back to back fold into one entry.
   * Commands that share a key must write through equivalent stores: a fold keeps
   * the store of the first command and writes the whole entry through it.
   * Different store objects with the same key are fine (an app may build one
   * per command); stores that reach different data must use different keys.
   */
  coalesceKey?: string;
  /** The label of a merged entry. Without it the newer command's label wins. */
  relabel?: (merged: readonly Transition<V>[]) => string;
  /** Value equality; Object.is by default. Pass a set comparison for tag lists. */
  equals?: (a: V, b: V) => boolean;
  /**
   * The caller already put this command's first execute on screen (a chip
   * that changes as it is clicked). The first execute's preview then shows
   * nothing and its commit is told `previewed: true`. Later undo and redo
   * presses preview through `store.show` as usual.
   */
  shown?: boolean;
}

export interface TransitionCommandHandle<V> extends Command {
  /**
   * What the command currently covers: trimmed to the applied ids after a
   * partial outcome, and empty after a first execute that applied nothing. A
   * merged entry computes it from its parts until its first undo or redo runs.
   */
  readonly transitions: readonly Transition<V>[];
  preview(direction: "execute" | "undo"): void;
  /**
   * Drop every preview still waiting for a commit, and show what the last
   * settled step left in the store: applied ids show its `next`, failed ids
   * its `expected`, stale ids the `current` the store reported.
   */
  reconcile(): void;
}

type Direction = "execute" | "undo";

/** One press's preview, waiting for the commit it belongs to. */
interface PressPreview {
  direction: Direction;
  /** The ids handed to store.show, or null when nothing was shown. */
  ids: ReadonlySet<string> | null;
}

const handles = new WeakSet<Command>();
// Consumes a command's oldest waiting preview without committing, for a
// composite whose other half threw before this half's step ran.
const skipPress = new WeakMap<Command, (direction: Direction) => void>();
// Every handle that has presses waiting for their commit. A store correction
// (an id that did not apply) or a reconcile may overwrite what any of those
// presses put on screen, even from another command or another store whose ids
// collide, so it unmarks them all: their commits go out as not previewed and
// the store re-shows what it applied. Coarse on purpose; the cost is one extra
// screen write. A handle leaves the set as soon as nothing of it is waiting.
const waiting = new Set<{ invalidate(): void }>();

function invalidateEveryWaitingPreview() {
  for (const waiter of [...waiting]) waiter.invalidate();
}
// A merged entry that has not run yet exposes its parts here, so merging it
// again extends one flat list instead of nesting groups.
const groupParts = new WeakMap<Command, () => readonly TransitionCommandHandle<unknown>[] | null>();

export function isTransitionCommand<V = unknown>(command: Command): command is TransitionCommandHandle<V> {
  return handles.has(command);
}

export function transitionCommand<V>(options: TransitionCommandOptions<V>): TransitionCommandHandle<V> {
  const equals = options.equals ?? Object.is;
  return build(options, collapseDuplicates(options.transitions, equals), null, options.label);
}

/**
 * The handle behind both a plain transition command (`list` given) and a
 * merged entry (`parts` given). A merged entry computes its transitions from
 * its parts until its first undo or execute runs, then keeps that list.
 */
function build<V>(
  options: TransitionCommandOptions<V>,
  list: Transition<V>[] | null,
  initialParts: TransitionCommandHandle<V>[] | null,
  label: string
): TransitionCommandHandle<V> {
  const equals = options.equals ?? Object.is;
  const isGroup = initialParts !== null;
  let own: Transition<V>[] | null = list;
  let parts: TransitionCommandHandle<V>[] | null = initialParts;
  // Transitions an earlier undo attempt took back before another id failed. A
  // retried undo that finally finishes restores them to the list, so redo
  // re-applies everything that was actually undone.
  let undoneSoFar: Transition<V>[] = [];
  let applies = 0;
  // The caller showed the first execute; it has not been committed yet.
  let pendingShown = !isGroup && options.shown === true;
  // One entry per press that previewed, in press order. The history queues
  // steps in press order too, so each commit takes the oldest entry. Every
  // path that runs a step, or skips one, takes exactly one entry.
  const previews: PressPreview[] = [];
  // The last step that reached the store, for reconcile.
  let lastStep: { changes: TransitionChange<V>[]; results: TransitionResult<V>[] } | null = null;
  // The caller-shown first execute was pressed and still holds the screen.
  let shownPressed = false;
  let shownValid = true;
  const waiter = {
    invalidate() {
      for (const press of previews) press.ids = null;
      shownValid = false;
    },
  };
  function syncWaiting() {
    if (previews.length > 0 || shownPressed) waiting.add(waiter);
    else waiting.delete(waiter);
  }

  function current(): Transition<V>[] {
    return own ?? foldParts(parts ?? [], equals);
  }

  /** A merged entry fixes its list from its parts the first time it runs. */
  function materialize(): Transition<V>[] {
    if (own === null) {
      own = foldParts(parts ?? [], equals);
      parts = null;
    }
    return own;
  }

  function preview(direction: Direction) {
    // The caller already put the first execute on screen.
    if (direction === "execute" && pendingShown && previews.length === 0) {
      shownPressed = true;
      syncWaiting();
      return;
    }
    const entry: PressPreview = { direction, ids: null };
    previews.push(entry);
    syncWaiting();
    if (!options.store.show) return;
    const changes = changesFor(direction, current());
    if (changes.length > 0) options.store.show(changes);
    // Marked previewed only once show has returned; a throw leaves it unpreviewed.
    entry.ids = new Set(changes.map((c) => c.id));
  }

  /** Take the preview record of the press this step belongs to. */
  function takePress(direction: Direction): { shownByCaller: boolean; ids: ReadonlySet<string> | null } {
    if (direction === "execute" && applies === 0 && pendingShown && !isGroup) {
      pendingShown = false;
      shownPressed = false;
      syncWaiting();
      return { shownByCaller: shownValid, ids: null };
    }
    pendingShown = false;
    shownPressed = false;
    const press = previews.shift();
    syncWaiting();
    return { shownByCaller: false, ids: press && press.direction === direction ? press.ids : null };
  }

  function reconcile() {
    previews.length = 0;
    pendingShown = false;
    shownPressed = false;
    syncWaiting();
    // What it re-shows below may overwrite other commands' waiting previews.
    invalidateEveryWaitingPreview();
    if (!lastStep || !options.store.show) return;
    const truth: TransitionChange<V>[] = [];
    lastStep.changes.forEach((c, i) => {
      const r = lastStep!.results[i];
      if (r.status === "applied") truth.push(c);
      else if (r.status === "failed") truth.push({ id: c.id, expected: c.next, next: c.expected });
      else if (r.current !== undefined) truth.push({ id: c.id, expected: c.expected, next: r.current });
    });
    if (truth.length > 0) options.store.show(truth);
  }

  async function apply(direction: Direction): Promise<Outcome> {
    const firstExecute = !isGroup && applies === 0 && direction === "execute";
    const { shownByCaller, ids } = takePress(direction);
    applies += 1;
    if (!firstExecute) return commitStep(direction, shownByCaller, ids);
    try {
      const outcome = await commitStep(direction, shownByCaller, ids);
      // The run applied nothing, so the command covers nothing. The history drops
      // the entry anyway; this keeps a merged entry from undoing a part that never landed.
      if (outcome?.kind === "skipped") own = [];
      return outcome;
    } catch (error) {
      // A first execute only throws when nothing is known to have applied.
      own = [];
      throw error;
    }
  }

  async function commitStep(
    direction: Direction,
    shownByCaller: boolean,
    previewedIds: ReadonlySet<string> | null
  ): Promise<Outcome> {
    const transitions = materialize();
    const changes = changesFor(direction, transitions);
    let previewed = shownByCaller || previewedIds !== null;
    if (previewedIds !== null && options.store.show) {
      // The list can grow between press and commit (a retried undo that finishes
      // restores ids). Show those now so the whole commit is previewed.
      const missing = changes.filter((c) => !previewedIds.has(c.id));
      if (missing.length > 0) {
        try {
          options.store.show(missing);
        } catch {
          previewed = false;
        }
      }
    }
    let raw: TransitionResult<V>[] = [];
    if (changes.length > 0) {
      try {
        raw = await options.store.commit(changes, { direction, previewed });
      } catch (error) {
        // Nothing is known about what landed; reconcile treats every id as failed.
        lastStep = { changes, results: changes.map((c) => ({ id: c.id, status: "failed", error })) };
        invalidateEveryWaitingPreview();
        throw error;
      }
    }
    // Match by id, in change order: a missing result is a failed write, a result for an unknown id is noise.
    const byId = new Map<string, TransitionResult<V>>();
    for (const r of raw) if (!byId.has(r.id)) byId.set(r.id, r);
    const results = changes.map(
      (c): TransitionResult<V> =>
        byId.get(c.id) ?? { id: c.id, status: "failed", error: new Error("The store returned no result for this change.") }
    );
    const applied = results.filter((r) => r.status === "applied");
    const stale = results.filter((r) => r.status === "stale").length;
    const failed = results.filter((r) => r.status === "failed").length;
    if (changes.length > 0) lastStep = { changes, results };
    if (applied.length < changes.length) invalidateEveryWaitingPreview();
    const report: TransitionReport<V> = {
      direction,
      total: changes.length,
      applied: applied.length,
      stale,
      failed,
      results,
    };
    if (changes.length === 0) return { kind: "skipped", message: options.describe(report) };
    if (direction === "undo" && failed > 0) {
      // The entry stays on the undo stack and covers only the ids that did not
      // write, so one more undo retries exactly those. Stale ids are never rewritten.
      const retry = new Set(results.filter((r) => r.status === "failed").map((r) => r.id));
      const done = new Set(applied.map((r) => r.id));
      undoneSoFar = [...undoneSoFar, ...transitions.filter((t) => done.has(t.id))];
      own = transitions.filter((t) => retry.has(t.id));
      throw new Error(options.describe(report));
    }
    if (direction === "undo" && undoneSoFar.length > 0) {
      // A retry that ends without a failure: the entry now covers every id any attempt undid.
      const done = new Set(applied.map((r) => r.id));
      own = [...undoneSoFar, ...transitions.filter((t) => done.has(t.id))];
      undoneSoFar = [];
      return applied.length === changes.length ? undefined : { kind: "partial", message: options.describe(report) };
    }
    if (applied.length === changes.length) return undefined;
    if (applied.length > 0) {
      const keep = new Set(applied.map((r) => r.id));
      own = transitions.filter((t) => keep.has(t.id));
      return { kind: "partial", message: options.describe(report) };
    }
    // Nothing applied. A failed write throws (even beside stale ids) so the entry stays put for a retry.
    if (failed === 0 && stale > 0) return { kind: "skipped", message: options.describe(report) };
    throw new Error(options.describe(report));
  }

  /**
   * Merging happens at the press, before either command has executed, so the
   * result is a group that keeps its parts and reads their transitions as they
   * settle: per id, the first part's before and the last part's after. Each
   * part still executes as its own queued run; the group's execute is only
   * called for a redo.
   */
  function merge(next: Command): Command | null {
    if (!isTransitionCommand<V>(next)) return compositeCommand(handle, next);
    const mine = own === null && parts ? parts : [handle];
    const theirs = (groupParts.get(next)?.() as TransitionCommandHandle<V>[] | null | undefined) ?? [next];
    const all = [...mine, ...theirs];
    const merged = foldParts(all, equals);
    // Cancelled out at the press. A part still queued runs anyway and its result corrects the screen.
    if (merged.length === 0) return null;
    return build<V>(
      { ...options, shown: false },
      null,
      all,
      options.relabel ? options.relabel(merged) : next.label
    );
  }

  const handle: TransitionCommandHandle<V> = {
    label,
    coalesceKey: options.coalesceKey,
    execute: () => apply("execute"),
    undo: () => apply("undo"),
    preview,
    reconcile,
    merge,
    get transitions() {
      return current();
    },
  };
  handles.add(handle);
  skipPress.set(handle, (direction) => {
    takePress(direction);
  });
  if (isGroup) groupParts.set(handle, () => (own === null ? parts : null));
  return handle;
}

function changesFor<V>(direction: Direction, transitions: readonly Transition<V>[]): TransitionChange<V>[] {
  return transitions.map((t) =>
    direction === "execute"
      ? { id: t.id, expected: t.before, next: t.after }
      : { id: t.id, expected: t.after, next: t.before }
  );
}

/** Per id across the parts in order: the first before, the last after; ids that end where they began are dropped. */
function foldParts<V>(parts: readonly TransitionCommandHandle<V>[], equals: (a: V, b: V) => boolean): Transition<V>[] {
  const byId = new Map<string, Transition<V>>();
  for (const part of parts) {
    for (const t of part.transitions) {
      const existing = byId.get(t.id);
      byId.set(t.id, existing ? { id: t.id, before: existing.before, after: t.after } : t);
    }
  }
  return [...byId.values()].filter((t) => !equals(t.before, t.after));
}

/** One transition per id: the first before, the last after; ones that end up unchanged are dropped. */
function collapseDuplicates<V>(list: readonly Transition<V>[], equals: (a: V, b: V) => boolean): Transition<V>[] {
  const byId = new Map<string, Transition<V>>();
  const repeated = new Set<string>();
  for (const t of list) {
    const existing = byId.get(t.id);
    if (existing) {
      repeated.add(t.id);
      byId.set(t.id, { id: t.id, before: existing.before, after: t.after });
    } else {
      byId.set(t.id, t);
    }
  }
  return [...byId.values()].filter((t) => !repeated.has(t.id) || !equals(t.before, t.after));
}

/** Two unrelated commands under one entry: execute in order, undo in reverse. */
function compositeCommand(first: Command, second: Command): Command {
  // When one half throws, the other half's step never runs; its waiting
  // preview is consumed so its previews stay paired with its steps.
  async function stepOrSkip(run: () => Promise<Outcome> | Outcome, other: Command, direction: Direction): Promise<Outcome> {
    try {
      return await run();
    } catch (error) {
      skipPress.get(other)?.(direction);
      throw error;
    }
  }
  const composite: Command = {
    label: second.label,
    coalesceKey: first.coalesceKey,
    async execute() {
      const a = await stepOrSkip(() => first.execute(), second, "execute");
      return combine(a, await second.execute());
    },
    async undo() {
      const b = await stepOrSkip(() => second.undo(), first, "undo");
      return combine(await first.undo(), b);
    },
    reconcile() {
      let failure: { error: unknown } | null = null;
      for (const part of [second, first]) {
        try {
          part.reconcile?.();
        } catch (error) {
          failure ??= { error };
        }
      }
      if (failure) throw failure.error;
    },
    preview(direction) {
      // Both parts preview even if one throws; the first error is rethrown for the history to surface.
      const order = direction === "undo" ? [second, first] : [first, second];
      let failure: { error: unknown } | null = null;
      for (const part of order) {
        try {
          part.preview?.(direction);
        } catch (error) {
          failure ??= { error };
        }
      }
      if (failure) throw failure.error;
    },
  };
  skipPress.set(composite, (direction) => {
    skipPress.get(first)?.(direction);
    skipPress.get(second)?.(direction);
  });
  return composite;
}

function combine(a: Outcome, b: Outcome): Outcome {
  if (!a && !b) return undefined;
  const message = [a?.message, b?.message].filter(Boolean).join(" ");
  if (a?.kind === "skipped" && b?.kind === "skipped") return { kind: "skipped", message };
  return { kind: "partial", message };
}
