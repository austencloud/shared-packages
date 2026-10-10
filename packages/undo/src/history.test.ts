import { describe, expect, it, vi } from "vitest";
import { createHistory } from "./history.js";
import type { Command, Outcome } from "./types.js";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A command that logs what it does. `overrides` replace execute/undo/merge. */
function command(label: string, log: string[], overrides: Partial<Command> = {}): Command {
  return {
    label,
    execute: () => {
      log.push(`do ${label}`);
    },
    undo: () => {
      log.push(`undo ${label}`);
    },
    ...overrides,
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createHistory", () => {
  it("runs a command and keeps it for undo", async () => {
    const log: string[] = [];
    const history = createHistory();
    const result = await history.run(command("Add Fire", log));
    expect(result).toEqual({ status: "done", label: "Add Fire" });
    expect(log).toEqual(["do Add Fire"]);
    expect(history.state.canUndo).toBe(true);
    expect(history.state.undoLabel).toBe("Add Fire");
    expect(history.state.canRedo).toBe(false);
    expect(history.state.lastAction).toEqual({ kind: "run", label: "Add Fire", status: "done" });
  });

  it("undo moves the entry to redo and redo executes it again", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("Add Fire", log));
    expect(await history.undo()).toEqual({ status: "done", label: "Add Fire" });
    expect(history.state).toMatchObject({ canUndo: false, canRedo: true, redoLabel: "Add Fire" });
    expect(await history.redo()).toEqual({ status: "done", label: "Add Fire" });
    expect(history.state).toMatchObject({ canUndo: true, canRedo: false, undoLabel: "Add Fire" });
    expect(log).toEqual(["do Add Fire", "undo Add Fire", "do Add Fire"]);
  });

  it("a new run clears the redo stack", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("A", log));
    await history.undo();
    await history.run(command("B", log));
    expect(history.state.canRedo).toBe(false);
    expect(history.state.undoLabel).toBe("B");
  });

  it("runs commands one at a time in the order they arrive", async () => {
    const log: string[] = [];
    const gate = deferred();
    const history = createHistory();
    const first = history.run(
      command("A", log, {
        execute: async () => {
          log.push("start A");
          await gate.promise;
          log.push("end A");
        },
      })
    );
    const second = history.run(command("B", log));
    const third = history.undo();
    await tick();
    expect(log).toEqual(["start A"]);
    gate.resolve();
    await Promise.all([first, second, third]);
    expect(log).toEqual(["start A", "end A", "do B", "undo B"]);
  });

  it("publishes busy as soon as work is queued and clears it when the queue drains", async () => {
    const log: string[] = [];
    const gate = deferred();
    const history = createHistory();
    const seen: boolean[] = [];
    history.subscribe((state) => seen.push(state.busy));
    const running = history.run(command("A", log, { execute: () => gate.promise }));
    expect(history.state.busy).toBe(true);
    expect(seen).toEqual([true]);
    gate.resolve();
    await running;
    expect(history.state.busy).toBe(false);
    expect(seen.at(-1)).toBe(false);
  });

  it("drops the oldest entry past the limit", async () => {
    const log: string[] = [];
    const history = createHistory({ limit: 2 });
    await history.run(command("A", log));
    await history.run(command("B", log));
    await history.run(command("C", log));
    await history.undo();
    await history.undo();
    expect(await history.undo()).toEqual({ status: "empty", label: null });
    expect(log).toEqual(["do A", "do B", "do C", "undo C", "undo B"]);
  });

  it("merges a command into the top entry when both share a coalesce key", async () => {
    const log: string[] = [];
    const history = createHistory();
    const merged = command("Paint onto 2", log);
    const first = command("Paint onto 1", log, {
      coalesceKey: "stroke:1",
      merge: () => merged,
    });
    const second = command("Paint onto 1 more", log, { coalesceKey: "stroke:1" });
    const other = command("Paint onto 1", log, { coalesceKey: "stroke:2" });
    await history.run(first);
    await history.run(second);
    expect(history.state.undoLabel).toBe("Paint onto 2");
    await history.run(other);
    expect(history.state.undoLabel).toBe("Paint onto 1");
    await history.undo();
    await history.undo();
    expect(history.state.canUndo).toBe(false);
    expect(log).toEqual(["do Paint onto 1", "do Paint onto 1 more", "do Paint onto 1", "undo Paint onto 1", "undo Paint onto 2"]);
  });

  it("removes the entry when a merge returns null", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("Add", log, { coalesceKey: "k", merge: () => null }));
    await history.run(command("Remove", log, { coalesceKey: "k" }));
    expect(history.state.canUndo).toBe(false);
  });

  it("keeps a partial entry and shows its message until the next clean outcome", async () => {
    const log: string[] = [];
    const history = createHistory();
    const partial: Outcome = { kind: "partial", message: "9 of 12" };
    const result = await history.run(command("A", log, { execute: () => partial }));
    expect(result).toEqual({ status: "partial", label: "A", message: "9 of 12" });
    expect(history.state).toMatchObject({ canUndo: true, lastMessage: "9 of 12" });
    expect(history.state.lastAction).toEqual({ kind: "run", label: "A", status: "partial" });
    await history.run(command("B", log));
    expect(history.state.lastMessage).toBeNull();
  });

  it("records nothing for a skipped run but keeps its message", async () => {
    const log: string[] = [];
    const history = createHistory();
    const skipped: Outcome = { kind: "skipped", message: "all changed since" };
    const result = await history.run(command("A", log, { execute: () => skipped }));
    expect(result).toEqual({ status: "skipped", label: "A", message: "all changed since" });
    expect(history.state).toMatchObject({ canUndo: false, lastMessage: "all changed since" });
  });

  it("reports a thrown error as failed and leaves the entry in place", async () => {
    const log: string[] = [];
    const history = createHistory();
    const boom = new Error("offline");
    const failedRun = await history.run(
      command("A", log, {
        execute: () => {
          throw boom;
        },
      })
    );
    expect(failedRun).toEqual({ status: "failed", label: "A", error: boom });
    expect(history.state.canUndo).toBe(false);
    await history.run(command("B", log));
    const failedUndo = await history.undo();
    void failedUndo;
    const flaky = command("C", log, {
      undo: () => {
        throw boom;
      },
    });
    await history.run(flaky);
    expect(await history.undo()).toEqual({ status: "failed", label: "C", error: boom });
    expect(history.state).toMatchObject({ canUndo: true, undoLabel: "C", canRedo: false, lastMessage: null });
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "C", status: "failed" });
  });

  it("drops an entry whose undo was skipped without offering it for redo", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("A", log, { undo: () => ({ kind: "skipped", message: "gone" }) }));
    expect(await history.undo()).toEqual({ status: "skipped", label: "A", message: "gone" });
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false, lastMessage: "gone" });
  });

  it("answers empty when there is nothing to undo or redo", async () => {
    const history = createHistory();
    expect(await history.undo()).toEqual({ status: "empty", label: null });
    expect(await history.redo()).toEqual({ status: "empty", label: null });
    expect(history.state.lastAction).toBeNull();
  });

  it("clear forgets the stacks, the message and the last action", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("A", log, { execute: () => ({ kind: "partial", message: "m" }) }));
    await history.run(command("B", log));
    await history.undo();
    history.clear();
    expect(history.state).toEqual({
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
      busy: false,
      lastMessage: null,
      lastAction: null,
    });
  });

  it("gives subscribers frozen snapshots and stops after unsubscribe", async () => {
    const log: string[] = [];
    const history = createHistory();
    const seen: string[] = [];
    const stop = history.subscribe((state) => {
      expect(Object.isFrozen(state)).toBe(true);
      seen.push(`${state.busy ? "busy" : "idle"}:${state.undoLabel ?? "-"}`);
    });
    await history.run(command("A", log));
    stop();
    await history.run(command("B", log));
    expect(seen).toEqual(["busy:-", "idle:A"]);
    expect(history.state.undoLabel).toBe("B");
  });

  it("record keeps an already-applied command without executing it", () => {
    const log: string[] = [];
    const history = createHistory();
    history.record(command("A", log));
    expect(log).toEqual([]);
    expect(history.state.undoLabel).toBe("A");
  });

  describe("clear and record while work is in flight", () => {
    it("clear during a pending run leaves both stacks empty after it settles", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      const running = history.run(command("A", log, { execute: () => gate.promise }));
      history.clear();
      gate.resolve();
      await running;
      expect(history.state).toMatchObject({ canUndo: false, canRedo: false, busy: false, lastAction: null, lastMessage: null });
    });

    it("clear during a pending undo leaves the redo stack empty", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      await history.run(command("A", log, { undo: () => gate.promise }));
      const undoing = history.undo();
      await tick();
      history.clear();
      gate.resolve();
      await undoing;
      expect(history.state).toMatchObject({ canUndo: false, canRedo: false, lastAction: null });
    });

    it("clear during a pending redo leaves the undo stack empty", async () => {
      const log: string[] = [];
      const history = createHistory();
      const gate = deferred();
      let first = true;
      await history.run(
        command("A", log, {
          execute: () => {
            if (first) {
              first = false;
              return;
            }
            return gate.promise;
          },
        })
      );
      await history.undo();
      const redoing = history.redo();
      await tick();
      history.clear();
      gate.resolve();
      await redoing;
      expect(history.state).toMatchObject({ canUndo: false, canRedo: false });
    });

    it("an undo queued before clear does not undo what was recorded after it", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      const running = history.run(command("A", log, { execute: () => gate.promise }));
      const undoing = history.undo();
      history.clear();
      history.record(command("Z", log));
      gate.resolve();
      await running;
      expect(await undoing).toEqual({ status: "empty", label: null });
      expect(log).toEqual([]);
      expect(history.state.undoLabel).toBe("Z");
    });

    it("record during a pending undo keeps the new entry and moves the undone one to redo once", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      await history.run(command("A", log, { undo: () => gate.promise }));
      const undoing = history.undo();
      await tick();
      history.record(command("X", log));
      gate.resolve();
      await undoing;
      expect(history.state).toMatchObject({ undoLabel: "X", canRedo: true, redoLabel: "A" });
      await history.undo();
      expect(history.state.canUndo).toBe(false);
      expect(history.state.redoLabel).toBe("X");
      await history.redo();
      await history.redo();
      expect(history.state).toMatchObject({ canRedo: false, undoLabel: "A" });
    });
  });

  it("keeps a command whose merge throws as its own entry", async () => {
    const log: string[] = [];
    const history = createHistory();
    const throwing = () => {
      throw new Error("merge exploded");
    };
    await history.run(command("A", log, { coalesceKey: "k", merge: throwing }));
    const result = await history.run(command("B", log, { coalesceKey: "k", merge: throwing }));
    expect(result).toEqual({ status: "done", label: "B" });
    expect(history.state).toMatchObject({ undoLabel: "B", busy: false });
    await history.undo();
    expect(log).toEqual(["do A", "do B", "undo B"]);
    expect(history.state.undoLabel).toBe("A");
  });

  describe("listener errors", () => {
    it("a throwing listener does not stop the others, run resolves, busy clears", async () => {
      const log: string[] = [];
      const rethrown: unknown[] = [];
      const stub = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
        try {
          callback();
        } catch (error) {
          rethrown.push(error);
        }
      });
      try {
        const history = createHistory();
        const boom = new Error("listener");
        const seen: boolean[] = [];
        history.subscribe(() => {
          throw boom;
        });
        history.subscribe((state) => seen.push(state.busy));
        const result = await history.run(command("A", log));
        expect(result).toEqual({ status: "done", label: "A" });
        expect(seen).toEqual([true, false]);
        expect(history.state.busy).toBe(false);
        expect(history.state.undoLabel).toBe("A");
        expect(rethrown).toEqual([boom, boom]);
      } finally {
        stub.mockRestore();
      }
    });
  });

  describe("outcomes and options", () => {
    it("treats any outcome other than kind partial or skipped as done", async () => {
      const log: string[] = [];
      const history = createHistory();
      const odd = { kind: "unexpected", message: "?" } as unknown as Outcome;
      expect(await history.run(command("A", log, { execute: () => odd }))).toEqual({ status: "done", label: "A" });
      expect(history.state.lastMessage).toBeNull();
      expect(history.state.lastAction).toEqual({ kind: "run", label: "A", status: "done" });
    });

    it("rejects a limit that is not a non-negative finite number", () => {
      expect(() => createHistory({ limit: Number.NaN })).toThrow(RangeError);
      expect(() => createHistory({ limit: Number.POSITIVE_INFINITY })).toThrow(RangeError);
      expect(() => createHistory({ limit: -1 })).toThrow(RangeError);
      expect(() => createHistory({ limit: 5 })).not.toThrow();
    });
  });

  describe("coalescing after undo, redo and clear", () => {
    function spyMerge(label: string, log: string[], key: string) {
      const merge = vi.fn(() => command(`${label} merged`, log));
      return { cmd: command(label, log, { coalesceKey: key, merge }), merge };
    }

    it("a run after an undo does not merge into the older entry", async () => {
      const log: string[] = [];
      const history = createHistory();
      const older = spyMerge("P", log, "k");
      await history.run(older.cmd);
      await history.run(command("R", log, { coalesceKey: "other" }));
      await history.undo();
      await history.run(command("Q", log, { coalesceKey: "k" }));
      expect(older.merge).not.toHaveBeenCalled();
      expect(history.state.undoLabel).toBe("Q");
      await history.undo();
      expect(history.state.undoLabel).toBe("P");
    });

    it("a run after a redo does not merge into the redone entry", async () => {
      const log: string[] = [];
      const history = createHistory();
      const redone = spyMerge("R", log, "k");
      await history.run(command("P", log, { coalesceKey: "other" }));
      await history.run(redone.cmd);
      await history.undo();
      await history.redo();
      await history.run(command("S", log, { coalesceKey: "k" }));
      expect(redone.merge).not.toHaveBeenCalled();
      expect(history.state.undoLabel).toBe("S");
    });

    it("a run after clear and record does not merge into the recorded entry", async () => {
      const log: string[] = [];
      const history = createHistory();
      await history.run(command("X", log, { coalesceKey: "k" }));
      history.clear();
      const recorded = spyMerge("P", log, "k");
      history.record(recorded.cmd);
      await history.run(command("Q", log, { coalesceKey: "k" }));
      expect(recorded.merge).not.toHaveBeenCalled();
      expect(history.state.undoLabel).toBe("Q");
    });

    it("back-to-back runs still merge", async () => {
      const log: string[] = [];
      const history = createHistory();
      const first = spyMerge("P", log, "k");
      await history.run(first.cmd);
      await history.run(command("Q", log, { coalesceKey: "k" }));
      expect(first.merge).toHaveBeenCalledTimes(1);
      expect(history.state.undoLabel).toBe("P merged");
    });
  });
});
