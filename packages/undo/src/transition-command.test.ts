import { describe, expect, it } from "vitest";
import { createHistory } from "./history.js";
import { memoryTransitionStore } from "./memory-store.js";
import {
  isTransitionCommand,
  transitionCommand,
  type Transition,
  type TransitionCommandOptions,
  type TransitionReport,
} from "./transition-command.js";
import type { Command } from "./types.js";

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const report = (r: TransitionReport<string[]>) =>
  `${r.direction}:${r.applied}/${r.total} stale ${r.stale} failed ${r.failed}`;

function tagCommand(
  store: TransitionCommandOptions<string[]>["store"],
  transitions: Transition<string[]>[],
  extra: Partial<TransitionCommandOptions<string[]>> = {}
) {
  return transitionCommand<string[]>({
    label: "Add Fire",
    transitions,
    store,
    describe: report,
    equals: sameList,
    ...extra,
  });
}

describe("transitionCommand", () => {
  it("writes after on execute and before on undo, as expected/next changes", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", ["x"]]], sameList);
    const history = createHistory();
    const command = tagCommand(store, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: ["x"], after: ["x", "fire"] },
    ]);
    expect(await history.run(command)).toEqual({ status: "done", label: "Add Fire" });
    expect(store.get("a")).toEqual(["fire"]);
    expect(store.get("b")).toEqual(["x", "fire"]);
    await history.undo();
    expect(store.get("a")).toEqual([]);
    expect(store.get("b")).toEqual(["x"]);
    await history.redo();
    expect(store.get("a")).toEqual(["fire"]);
    expect(store.get("b")).toEqual(["x", "fire"]);
  });

  it("reports partial, keeps only the applied ids, and undoes just those", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", ["elsewhere"]]], sameList);
    const history = createHistory();
    const command = tagCommand(store, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
    ]);
    expect(await history.run(command)).toEqual({
      status: "partial",
      label: "Add Fire",
      message: "execute:1/2 stale 1 failed 0",
    });
    expect(store.get("b")).toEqual(["elsewhere"]);
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);
    // Someone else sets b meanwhile; the undo must not touch it.
    store.set("b", ["fire"]);
    expect(await history.undo()).toEqual({ status: "done", label: "Add Fire" });
    expect(store.get("a")).toEqual([]);
    expect(store.get("b")).toEqual(["fire"]);
  });

  it("is skipped when every change is stale, and nothing is kept", async () => {
    const store = memoryTransitionStore<string[]>([["a", ["elsewhere"]]], sameList);
    const history = createHistory();
    const result = await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }]));
    expect(result).toEqual({ status: "skipped", label: "Add Fire", message: "execute:0/1 stale 1 failed 0" });
    expect(history.state.canUndo).toBe(false);
    expect(store.get("a")).toEqual(["elsewhere"]);
  });

  it("throws the description when nothing applied and every change failed", async () => {
    const store = memoryTransitionStore<string[]>([["a", []]], sameList);
    store.failNext("a");
    const history = createHistory();
    const result = await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }]));
    expect(result.status).toBe("failed");
    expect((result.error as Error).message).toBe("execute:0/1 stale 0 failed 1");
    expect(store.get("a")).toEqual([]);
    expect(history.state.canUndo).toBe(false);
  });

  it("is skipped with an empty transition list", async () => {
    const store = memoryTransitionStore<string[]>([], sameList);
    const history = createHistory();
    expect(await history.run(tagCommand(store, []))).toEqual({
      status: "skipped",
      label: "Add Fire",
      message: "execute:0/0 stale 0 failed 0",
    });
  });

  it("merges by id: first before, last after, round trips dropped, relabel applied", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []], ["c", ["fire"]]], sameList);
    const history = createHistory();
    const stroke: Partial<TransitionCommandOptions<string[]>> = {
      coalesceKey: "stroke:1",
      relabel: (merged) => `Paint onto ${merged.length}`,
    };
    await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }], stroke));
    await history.run(tagCommand(store, [{ id: "b", before: [], after: ["fire"] }], stroke));
    // c loses fire and gets it back in the same stroke: not a change.
    await history.run(tagCommand(store, [{ id: "c", before: ["fire"], after: [] }], stroke));
    await history.run(tagCommand(store, [{ id: "c", before: [], after: ["fire"] }], stroke));
    expect(history.state.undoLabel).toBe("Paint onto 2");
    await history.undo();
    expect(store.get("a")).toEqual([]);
    expect(store.get("b")).toEqual([]);
    expect(store.get("c")).toEqual(["fire"]);
    expect(history.state.canUndo).toBe(false);
  });

  it("removes the entry when a merge cancels everything out", async () => {
    const store = memoryTransitionStore<string[]>([["a", []]], sameList);
    const history = createHistory();
    await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }], { coalesceKey: "k" }));
    await history.run(tagCommand(store, [{ id: "a", before: ["fire"], after: [] }], { coalesceKey: "k" }));
    expect(store.get("a")).toEqual([]);
    expect(history.state.canUndo).toBe(false);
  });

  it("takes the newer label when there is no relabel", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []]], sameList);
    const history = createHistory();
    await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }], { coalesceKey: "k", label: "First" }));
    await history.run(tagCommand(store, [{ id: "b", before: [], after: ["fire"] }], { coalesceKey: "k", label: "Second" }));
    expect(history.state.undoLabel).toBe("Second");
  });

  it("falls back to a composite when the newer command is not a transition command", async () => {
    const store = memoryTransitionStore<string[]>([["a", []]], sameList);
    const history = createHistory();
    const log: string[] = [];
    await history.run(tagCommand(store, [{ id: "a", before: [], after: ["fire"] }], { coalesceKey: "k" }));
    const plain: Command = {
      label: "Plain",
      coalesceKey: "k",
      execute: () => {
        log.push("do");
      },
      undo: () => {
        log.push("undo");
      },
    };
    await history.run(plain);
    expect(history.state.undoLabel).toBe("Plain");
    await history.undo();
    expect(log).toEqual(["do", "undo"]);
    expect(store.get("a")).toEqual([]);
    expect(history.state.canUndo).toBe(false);
  });

  it("isTransitionCommand tells handles from plain commands", () => {
    const store = memoryTransitionStore<string[]>([], sameList);
    expect(isTransitionCommand(tagCommand(store, []))).toBe(true);
    expect(isTransitionCommand({ label: "x", execute() {}, undo() {} })).toBe(false);
  });
});
