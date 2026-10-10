// An in-memory TransitionStore for tests and for apps whose state lives in
// memory. Compares with the given equality, Object.is by default.

import type { TransitionChange, TransitionResult, TransitionStore } from "./transition-command.js";

export interface MemoryTransitionStore<V> extends TransitionStore<V> {
  get(id: string): V | undefined;
  set(id: string, value: V): void;
  delete(id: string): void;
  /** Make the next commit report these ids as failed, without changing them. */
  failNext(...ids: string[]): void;
}

export function memoryTransitionStore<V>(
  initial: Iterable<readonly [string, V]> = [],
  equals: (a: V, b: V) => boolean = Object.is
): MemoryTransitionStore<V> {
  const values = new Map<string, V>(initial);
  const failing = new Set<string>();
  return {
    async commit(changes: TransitionChange<V>[]) {
      const results = changes.map((change): TransitionResult<V> => {
        if (failing.has(change.id)) return { id: change.id, status: "failed", error: new Error("write failed") };
        if (!values.has(change.id)) return { id: change.id, status: "stale", current: undefined };
        const current = values.get(change.id) as V;
        if (!equals(current, change.expected)) return { id: change.id, status: "stale", current };
        values.set(change.id, change.next);
        return { id: change.id, status: "applied" };
      });
      failing.clear();
      return results;
    },
    get: (id) => values.get(id),
    set(id, value) {
      values.set(id, value);
    },
    delete(id) {
      values.delete(id);
    },
    failNext(...ids) {
      for (const id of ids) failing.add(id);
    },
  };
}
