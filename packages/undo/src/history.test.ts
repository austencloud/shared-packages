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
    // The entry is on the stack from the press, in the same publish that reports busy.
    expect(seen).toEqual(["busy:A", "idle:A"]);
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
    it("asks a command to reconcile when clear drops its queued press", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      const running = history.run(command("A", log, { execute: () => gate.promise }));
      const reconcile = vi.fn();
      const dropped = history.run(command("B", log, { reconcile }));
      history.clear();
      gate.resolve();
      await Promise.all([running, dropped]);
      expect(log).not.toContain("do B");
      expect(reconcile).toHaveBeenCalledTimes(1);
    });

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

    it("a run queued behind pending work never executes once clear() has run", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      const first = history.run(command("A", log, { execute: () => gate.promise }));
      const second = history.run(command("B", log));
      history.clear();
      gate.resolve();
      await first;
      expect(await second).toEqual({ status: "empty", label: null });
      expect(log).toEqual([]);
      expect(history.state.canUndo).toBe(false);
    });

    it("record during a pending undo keeps the new entry and does not offer the undone one for redo", async () => {
      const log: string[] = [];
      const gate = deferred();
      const history = createHistory();
      await history.run(command("A", log, { undo: () => gate.promise }));
      const undoing = history.undo();
      await tick();
      history.record(command("X", log));
      gate.resolve();
      await undoing;
      // A new action happened after the undo started, so there is no redo: the undone entry is gone.
      expect(history.state).toMatchObject({ undoLabel: "X", canRedo: false, redoLabel: null });
      await history.undo();
      expect(history.state.canUndo).toBe(false);
      expect(history.state.redoLabel).toBe("X");
      await history.redo();
      expect(history.state).toMatchObject({ canRedo: false, undoLabel: "X" });
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
      expect(() => createHistory({ limit: 2.5 })).toThrow(RangeError);
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

describe("press-time stacks", () => {
  /** A command whose execute and undo wait on deferreds the test settles by hand. */
  function gated(label: string, log: string[]) {
    const runs: ReturnType<typeof deferred<Outcome>>[] = [];
    const undos: ReturnType<typeof deferred<Outcome>>[] = [];
    const previews: string[] = [];
    const cmd: Command = {
      label,
      execute: () => {
        log.push(`do ${label}`);
        const d = deferred<Outcome>();
        runs.push(d);
        return d.promise;
      },
      undo: () => {
        log.push(`undo ${label}`);
        const d = deferred<Outcome>();
        undos.push(d);
        return d.promise;
      },
      preview: (direction) => {
        previews.push(direction);
      },
    };
    return { cmd, runs, undos, previews };
  }

  it("moves the stacks and labels at the press, before any write settles", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const running = history.run(a.cmd);
    expect(history.state).toMatchObject({ canUndo: true, undoLabel: "A", canRedo: false, busy: true, lastAction: null });
    const undoing = history.undo();
    expect(history.state).toMatchObject({ canUndo: false, canRedo: true, redoLabel: "A", busy: true });
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "A", status: "pending" });
    const redoing = history.redo();
    expect(history.state).toMatchObject({ canUndo: true, undoLabel: "A", canRedo: false });
    expect(history.state.lastAction).toEqual({ kind: "redo", label: "A", status: "pending" });
    expect(a.previews).toEqual(["execute", "undo", "execute"]);

    // The writes still run one at a time, in press order: the undo waits for the run.
    await tick();
    expect(log).toEqual(["do A"]);
    a.runs[0].resolve();
    await running;
    expect(history.state).toMatchObject({ canUndo: true, canRedo: false, busy: true });
    await tick();
    expect(log).toEqual(["do A", "undo A"]);
    a.undos[0].resolve();
    await undoing;
    expect(history.state).toMatchObject({ canUndo: true, canRedo: false, busy: true });
    expect(history.state.lastAction).toEqual({ kind: "redo", label: "A", status: "pending" });
    await tick();
    a.runs[1].resolve();
    expect(await redoing).toEqual({ status: "done", label: "A" });
    expect(log).toEqual(["do A", "undo A", "do A"]);
    expect(history.state).toMatchObject({ canUndo: true, undoLabel: "A", canRedo: false, busy: false });
    expect(history.state.lastAction).toEqual({ kind: "redo", label: "A", status: "done" });
  });

  it("an undo that throws puts the entry back on top of the undo stack", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("A", log));
    const b = gated("B", log);
    const runB = history.run(b.cmd);
    await tick();
    b.runs[0].resolve();
    await runB;
    const undoing = history.undo();
    expect(history.state).toMatchObject({ undoLabel: "A", redoLabel: "B" });
    await tick();
    const boom = new Error("offline");
    b.undos[0].reject(boom);
    expect(await undoing).toEqual({ status: "failed", label: "B", error: boom });
    expect(history.state).toMatchObject({ undoLabel: "B", canRedo: false });
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "B", status: "failed" });
  });

  it("an undo that throws after a newer run cleared redo is still undoable, on top", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const runA = history.run(a.cmd);
    await tick();
    a.runs[0].resolve();
    await runA;
    const undoing = history.undo();
    const runC = history.run(command("C", log));
    expect(history.state).toMatchObject({ undoLabel: "C", canRedo: false });
    await tick();
    a.undos[0].reject(new Error("offline"));
    await Promise.all([undoing, runC]);
    expect(history.state).toMatchObject({ undoLabel: "A", canRedo: false });
    const again = history.undo();
    await tick();
    a.undos[1].resolve();
    await again;
    expect(history.state.undoLabel).toBe("C");
  });

  it("a redo that throws goes back on top of the redo stack", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const runA = history.run(a.cmd);
    await tick();
    a.runs[0].resolve();
    await runA;
    const undoing = history.undo();
    await tick();
    a.undos[0].resolve();
    await undoing;
    const redoing = history.redo();
    expect(history.state).toMatchObject({ undoLabel: "A", canRedo: false });
    await tick();
    a.runs[1].reject(new Error("offline"));
    expect((await redoing).status).toBe("failed");
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "A" });
    expect(history.state.lastAction).toEqual({ kind: "redo", label: "A", status: "failed" });
  });

  it("a redo that throws after a newer run cleared redo is dropped", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const runA = history.run(a.cmd);
    await tick();
    a.runs[0].resolve();
    await runA;
    const undoing = history.undo();
    await tick();
    a.undos[0].resolve();
    await undoing;
    const redoing = history.redo();
    const runC = history.run(command("C", log));
    await tick();
    a.runs[1].reject(new Error("offline"));
    await Promise.all([redoing, runC]);
    expect(history.state).toMatchObject({ undoLabel: "C", canRedo: false });
    await history.undo();
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "C" });
  });

  it("a run that throws leaves nothing undoable, even after a press-time undo moved it to redo", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const running = history.run(a.cmd);
    const undoing = history.undo();
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "A" });
    await tick();
    a.runs[0].reject(new Error("offline"));
    expect((await running).status).toBe("failed");
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false });
    // Its run applied nothing, so there is nothing for the queued undo to take back.
    expect(await undoing).toEqual({ status: "skipped", label: "A" });
    expect(log).toEqual(["do A"]);
    expect(history.state.lastAction).toEqual({ kind: "run", label: "A", status: "failed" });
  });

  it("a skipped run is removed from whichever stack holds it", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(command("Z", log));
    const a = gated("A", log);
    const running = history.run(a.cmd);
    expect(history.state.undoLabel).toBe("A");
    await tick();
    a.runs[0].resolve({ kind: "skipped", message: "changed elsewhere" });
    await running;
    expect(history.state).toMatchObject({ undoLabel: "Z", canRedo: false, lastMessage: "changed elsewhere" });
  });

  it("a stale done does not overwrite a newer pending action, but a stale failure surfaces", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const b = gated("B", log);
    const runA = history.run(a.cmd);
    const runB = history.run(b.cmd);
    const undoB = history.undo();
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "B", status: "pending" });
    await tick();
    await tick();
    a.runs[0].resolve();
    await runA;
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "B", status: "pending" });
    await tick();
    b.runs[0].resolve({ kind: "partial", message: "1 of 2" });
    await runB;
    expect(history.state.lastAction).toEqual({ kind: "run", label: "B", status: "partial" });
    expect(history.state.lastMessage).toBe("1 of 2");
    await tick();
    b.undos[0].resolve();
    await undoB;
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "B", status: "done" });
    expect(history.state.lastMessage).toBeNull();

    const c = gated("C", log);
    const runC = history.run(c.cmd);
    const undoC = history.undo();
    await tick();
    c.runs[0].reject(new Error("offline"));
    await runC;
    expect(history.state.lastAction).toEqual({ kind: "run", label: "C", status: "failed" });
    await undoC;
  });

  it("clear between press and settle leaves the cleared state alone", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = gated("A", log);
    const runA = history.run(a.cmd);
    await tick();
    a.runs[0].resolve();
    await runA;
    const undoing = history.undo();
    history.clear();
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false, lastAction: null });
    await tick();
    expect(await undoing).toEqual({ status: "empty", label: null });
    expect(log).toEqual(["do A"]);
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false, lastAction: null, busy: false });
  });

  it("an empty undo or redo answers at once without queueing or publishing", async () => {
    const history = createHistory();
    const seen: unknown[] = [];
    history.subscribe((state) => seen.push(state));
    const gate = deferred();
    const running = history.run({ label: "A", execute: () => gate.promise, undo() {} });
    seen.length = 0;
    // Nothing on redo: the empty redo does not wait behind the pending run.
    expect(await history.redo()).toEqual({ status: "empty", label: null });
    expect(seen).toEqual([]);
    gate.resolve();
    await running;
    await history.undo();
    await history.redo();
    await history.undo();
    seen.length = 0;
    expect(await history.undo()).toEqual({ status: "empty", label: null });
    expect(seen).toEqual([]);
    expect(history.state.busy).toBe(false);
  });

  it("calls preview once per press, and surfaces a throwing preview asynchronously", async () => {
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
      const boom = new Error("preview");
      const directions: string[] = [];
      const result = await history.run({
        label: "A",
        execute() {},
        undo() {},
        preview(direction) {
          directions.push(direction);
          throw boom;
        },
      });
      expect(result).toEqual({ status: "done", label: "A" });
      await history.undo();
      expect(directions).toEqual(["execute", "undo"]);
      expect(rethrown).toEqual([boom, boom]);
      expect(history.state).toMatchObject({ canUndo: false, redoLabel: "A" });
    } finally {
      stub.mockRestore();
    }
  });

  it("previews the pressed part, not the coalesced entry it folds into", async () => {
    const log: string[] = [];
    const history = createHistory();
    const previews: string[] = [];
    const group = command("Group", log, { preview: (d) => previews.push(`group:${d}`) });
    await history.run(command("P1", log, { coalesceKey: "k", merge: () => group, preview: (d) => previews.push(`p1:${d}`) }));
    await history.run(command("P2", log, { coalesceKey: "k", preview: (d) => previews.push(`p2:${d}`) }));
    await history.undo();
    expect(previews).toEqual(["p1:execute", "p2:execute", "group:undo"]);
  });
});

describe("cancelling later presses after a failure", () => {
  it("skips every later queued step of the failed entry without calling it, and reconciles it once", async () => {
    const log: string[] = [];
    const history = createHistory();
    const a = command("A", log, {
      undo: () => {
        log.push("undo A");
        throw new Error("offline");
      },
      reconcile: () => {
        log.push("reconcile A");
      },
    });
    await history.run(a);
    const b = command("B", log);
    const undoing = history.undo();
    const redoing = history.redo();
    const runB = history.run(b);
    const again = history.undo();
    // The last undo took B (on top), not A.
    await Promise.all([undoing, redoing, runB, again]);
    expect(await redoing).toEqual({ status: "skipped", label: "A" });
    expect(log).toEqual(["do A", "undo A", "reconcile A", "do B", "undo B"]);
    // The failed undo alone places A: back on top of the undo stack.
    expect(history.state).toMatchObject({ undoLabel: "A", redoLabel: "B" });
  });

  it("does not reconcile when nothing was cancelled", async () => {
    const log: string[] = [];
    const history = createHistory();
    await history.run(
      command("A", log, {
        undo: () => {
          throw new Error("offline");
        },
        reconcile: () => {
          log.push("reconcile A");
        },
      })
    );
    expect((await history.undo()).status).toBe("failed");
    expect(log).toEqual(["do A"]);
  });
});
