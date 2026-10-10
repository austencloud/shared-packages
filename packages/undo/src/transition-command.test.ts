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

describe("transitionCommand undo with failed writes", () => {
  it("keeps the entry and retries only the failed ids when undo has stale and failed ids but nothing applied", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []]], sameList);
    const history = createHistory();
    const command = tagCommand(store, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
    ]);
    await history.run(command);
    store.set("a", ["elsewhere"]);
    store.failNext("b");
    const first = await history.undo();
    expect(first.status).toBe("failed");
    expect((first.error as Error).message).toBe("undo:0/2 stale 1 failed 1");
    expect(history.state.canUndo).toBe(true);
    expect(history.state.canRedo).toBe(false);
    expect(command.transitions.map((t) => t.id)).toEqual(["b"]);
    expect(await history.undo()).toEqual({ status: "done", label: "Add Fire" });
    expect(store.get("b")).toEqual([]);
    expect(store.get("a")).toEqual(["elsewhere"]);
  });

  it("keeps the entry covering only the failed ids when undo has applied and failed ids", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []], ["c", []], ["d", []]], sameList);
    const history = createHistory();
    const command = tagCommand(
      store,
      ["a", "b", "c", "d"].map((id) => ({ id, before: [], after: ["fire"] }))
    );
    await history.run(command);
    store.set("d", ["elsewhere"]);
    store.failNext("b");
    const first = await history.undo();
    expect(first.status).toBe("failed");
    expect(store.get("a")).toEqual([]);
    expect(store.get("c")).toEqual([]);
    expect(store.get("b")).toEqual(["fire"]);
    expect(history.state.canUndo).toBe(true);
    expect(command.transitions.map((t) => t.id)).toEqual(["b"]);
    // The retry touches b only; a, c and the stale d are never rewritten.
    store.set("a", ["later"]);
    expect(await history.undo()).toEqual({ status: "done", label: "Add Fire" });
    expect(store.get("b")).toEqual([]);
    expect(store.get("a")).toEqual(["later"]);
    expect(store.get("d")).toEqual(["elsewhere"]);
  });

  it("redoes every id that was actually undone across a retried undo, and leaves stale ids alone", async () => {
    const store = memoryTransitionStore<string[]>([["id1", []], ["id2", []], ["id3", []]], sameList);
    const history = createHistory();
    const command = tagCommand(
      store,
      ["id1", "id2", "id3"].map((id) => ({ id, before: [], after: ["fire"] }))
    );
    await history.run(command);
    store.set("id3", ["elsewhere"]);
    store.failNext("id2");
    expect((await history.undo()).status).toBe("failed");
    expect(command.transitions.map((t) => t.id)).toEqual(["id2"]);
    // The retry undoes id2 and finishes cleanly; the entry moves to redo.
    expect(await history.undo()).toEqual({ status: "done", label: "Add Fire" });
    expect(history.state.canRedo).toBe(true);
    expect(command.transitions.map((t) => t.id)).toEqual(["id1", "id2"]);
    expect(await history.redo()).toEqual({ status: "done", label: "Add Fire" });
    expect(store.get("id1")).toEqual(["fire"]);
    expect(store.get("id2")).toEqual(["fire"]);
    expect(store.get("id3")).toEqual(["elsewhere"]);
  });

  it("moves to redo as partial when a retry finds only stale ids but earlier attempts undid some", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []]], sameList);
    const history = createHistory();
    const command = tagCommand(store, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
    ]);
    await history.run(command);
    store.failNext("b");
    await history.undo();
    store.set("b", ["elsewhere"]);
    const result = await history.undo();
    expect(result.status).toBe("partial");
    expect(history.state.canUndo).toBe(false);
    expect(history.state.canRedo).toBe(true);
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);
  });

  it("keeps the execute rules: trim to applied on partial, skipped when only stale and failed", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []], ["c", ["elsewhere"]]], sameList);
    store.failNext("b");
    const command = tagCommand(store, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
      { id: "c", before: [], after: ["fire"] },
    ]);
    const outcome = await command.execute();
    expect(outcome?.kind).toBe("partial");
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);

    const stuck = memoryTransitionStore<string[]>([["a", ["elsewhere"]], ["b", []]], sameList);
    stuck.failNext("b");
    const skipped = await tagCommand(stuck, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
    ]).execute();
    expect(skipped?.kind).toBe("skipped");
  });
});

describe("transitionCommand result matching", () => {
  const plain = (r: TransitionReport<string>) =>
    `${r.direction}:${r.applied}/${r.total} stale ${r.stale} failed ${r.failed}`;
  const two: Transition<string>[] = [
    { id: "a", before: "0", after: "1" },
    { id: "b", before: "0", after: "1" },
  ];

  it("counts a change with no result as failed", async () => {
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      transitions: two,
      store: { commit: async () => [{ id: "a", status: "applied" }] },
    });
    expect(await command.execute()).toEqual({ kind: "partial", message: "execute:1/2 stale 0 failed 1" });
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);
  });

  it("throws when the store returns no results at all", async () => {
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      transitions: two,
      store: { commit: async () => [] },
    });
    await expect(command.execute()).rejects.toThrow("execute:0/2 stale 0 failed 2");
  });

  it("ignores a result for an id that was not asked about", async () => {
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      transitions: two,
      store: {
        commit: async () => [
          { id: "a", status: "applied" },
          { id: "zzz", status: "applied" },
        ],
      },
    });
    expect(await command.execute()).toEqual({ kind: "partial", message: "execute:1/2 stale 0 failed 1" });
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);
  });

  it("matches results by id when the store answers in another order", async () => {
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      transitions: two,
      store: {
        commit: async () => [
          { id: "b", status: "applied" },
          { id: "a", status: "applied" },
        ],
      },
    });
    expect(await command.execute()).toBeUndefined();
  });

  it("collapses duplicate ids to the first before and last after", async () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      store,
      transitions: [
        { id: "a", before: "0", after: "1" },
        { id: "a", before: "1", after: "2" },
      ],
    });
    expect(command.transitions).toEqual([{ id: "a", before: "0", after: "2" }]);
    await command.execute();
    expect(store.get("a")).toBe("2");
    expect(await command.undo()).toBeUndefined();
    expect(store.get("a")).toBe("0");
  });

  it("drops duplicates that end up where they began", () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const command = transitionCommand<string>({
      label: "x",
      describe: plain,
      store,
      transitions: [
        { id: "a", before: "0", after: "1" },
        { id: "a", before: "1", after: "0" },
        { id: "b", before: "0", after: "1" },
      ],
    });
    expect(command.transitions.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("transitionCommand across stores", () => {
  const plain = (r: TransitionReport<string>) => `${r.direction}:${r.applied}/${r.total}`;

  it("does not fold a command that writes through another store", async () => {
    const s1 = memoryTransitionStore<string>([["a", "0"]]);
    const s2 = memoryTransitionStore<string>([["a", "0"]]);
    const history = createHistory();
    const make = (store: typeof s1) =>
      transitionCommand<string>({
        label: "x",
        describe: plain,
        store,
        coalesceKey: "k",
        transitions: [{ id: "a", before: "0", after: "1" }],
      });
    await history.run(make(s1));
    await history.run(make(s2));
    expect(s1.get("a")).toBe("1");
    expect(s2.get("a")).toBe("1");
    await history.undo();
    expect(s1.get("a")).toBe("0");
    expect(s2.get("a")).toBe("0");
    expect(history.state.canUndo).toBe(false);
  });

  it("undoes a composite's second command before its first", async () => {
    const log: string[] = [];
    const logging = (name: string) => {
      const inner = memoryTransitionStore<string>([["a", "0"]]);
      return {
        ...inner,
        commit: async (changes: Parameters<typeof inner.commit>[0]) => {
          log.push(`${name}:${changes[0].next}`);
          return inner.commit(changes);
        },
      };
    };
    const history = createHistory();
    const make = (store: ReturnType<typeof logging>) =>
      transitionCommand<string>({
        label: "x",
        describe: plain,
        store,
        coalesceKey: "k",
        transitions: [{ id: "a", before: "0", after: "1" }],
      });
    await history.run(make(logging("first")));
    await history.run(make(logging("second")));
    log.length = 0;
    await history.undo();
    expect(log).toEqual(["second:0", "first:0"]);
    await history.redo();
    expect(log).toEqual(["second:0", "first:0", "first:1", "second:1"]);
  });
});
