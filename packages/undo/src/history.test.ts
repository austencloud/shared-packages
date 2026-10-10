import { describe, expect, it } from "vitest";
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
});
