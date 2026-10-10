import { describe, expect, it } from "vitest";
import { createHistory } from "./history.js";
import { memoryTransitionStore, type MemoryTransitionStore } from "./memory-store.js";
import {
  isTransitionCommand,
  transitionCommand,
  type Transition,
  type TransitionCommandOptions,
  type TransitionReport,
  type TransitionStore,
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
    const stuckCommand = tagCommand(stuck, [
      { id: "a", before: [], after: ["fire"] },
      { id: "b", before: [], after: ["fire"] },
    ]);
    // Nothing applied and one write failed: that throws, even with a stale id alongside.
    await expect(stuckCommand.execute()).rejects.toThrow("execute:0/2 stale 1 failed 1");

    const onlyStale = memoryTransitionStore<string[]>([["a", ["elsewhere"]]], sameList);
    const skipped = await tagCommand(onlyStale, [{ id: "a", before: [], after: ["fire"] }]).execute();
    expect(skipped?.kind).toBe("skipped");
  });

  it("keeps a redo on the redo stack when it hit only stale and failed ids, so it can be retried", async () => {
    const store = memoryTransitionStore<string[]>([["a", []], ["b", []]], sameList);
    const history = createHistory();
    await history.run(
      tagCommand(store, [
        { id: "a", before: [], after: ["fire"] },
        { id: "b", before: [], after: ["fire"] },
      ])
    );
    await history.undo();
    store.set("a", ["elsewhere"]);
    store.failNext("b");
    const first = await history.redo();
    expect(first.status).toBe("failed");
    expect(history.state.canRedo).toBe(true);
    expect(history.state.canUndo).toBe(false);
    expect(await history.redo()).toEqual({ status: "partial", label: "Add Fire", message: "execute:1/2 stale 1 failed 0" });
    expect(store.get("b")).toEqual(["fire"]);
    expect(store.get("a")).toEqual(["elsewhere"]);
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

describe("transitionCommand coalescing", () => {
  const plain = (r: TransitionReport<string>) => `${r.direction}:${r.applied}/${r.total}`;

  it("folds back-to-back commands with one coalesceKey even when each has its own store object", async () => {
    const db = new Map<string, string>([["a", ""], ["b", ""], ["c", ""]]);
    // A new store object per command, as an app that builds its store per call does.
    const freshStore = (): TransitionCommandOptions<string>["store"] => ({
      async commit(changes) {
        return changes.map((c) => {
          if (db.get(c.id) !== c.expected) return { id: c.id, status: "stale" as const, current: db.get(c.id) };
          db.set(c.id, c.next);
          return { id: c.id, status: "applied" as const };
        });
      },
    });
    const segment = (id: string) =>
      transitionCommand<string>({
        label: "one",
        describe: plain,
        store: freshStore(),
        coalesceKey: "stroke:1",
        relabel: (merged) => `Paint ${merged.length}`,
        transitions: [{ id, before: "", after: "fire" }],
      });
    const history = createHistory();
    await history.run(segment("a"));
    expect(history.state.undoLabel).toBe("one");
    await history.run(segment("b"));
    expect(history.state.undoLabel).toBe("Paint 2");
    await history.run(segment("c"));
    expect(history.state.undoLabel).toBe("Paint 3");
    await history.undo();
    expect(history.state.canUndo).toBe(false);
    expect([db.get("a"), db.get("b"), db.get("c")]).toEqual(["", "", ""]);
    await history.redo();
    expect([db.get("a"), db.get("b"), db.get("c")]).toEqual(["fire", "fire", "fire"]);
  });

  it("undoes a composite entry's second command before its first", async () => {
    const log: string[] = [];
    const inner = memoryTransitionStore<string>([["a", "0"]]);
    const store = {
      ...inner,
      commit: async (changes: Parameters<typeof inner.commit>[0]) => {
        log.push(`first:${changes[0].next}`);
        return inner.commit(changes);
      },
    };
    const history = createHistory();
    await history.run(
      transitionCommand<string>({
        label: "x",
        describe: plain,
        store,
        coalesceKey: "k",
        transitions: [{ id: "a", before: "0", after: "1" }],
      })
    );
    await history.run({
      label: "plain",
      coalesceKey: "k",
      execute: () => {
        log.push("second:do");
      },
      undo: () => {
        log.push("second:undo");
      },
    });
    log.length = 0;
    await history.undo();
    expect(log).toEqual(["second:undo", "first:0"]);
    await history.redo();
    expect(log).toEqual(["second:undo", "first:0", "first:1", "second:do"]);
  });
});

describe("transitionCommand at press time", () => {
  const plain = (r: TransitionReport<string>) => `${r.direction}:${r.applied}/${r.total} stale ${r.stale} failed ${r.failed}`;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** A memory store whose commits wait until the test opens the gate. */
  function gatedStore(initial: [string, string][]) {
    const inner = memoryTransitionStore<string>(initial);
    const gates: (() => void)[] = [];
    const store: MemoryTransitionStore<string> = {
      ...inner,
      show: (changes) => inner.show(changes),
      async commit(changes, context) {
        await new Promise<void>((resolve) => gates.push(resolve));
        return inner.commit(changes, context);
      },
    };
    /** Let the oldest waiting commit through and wait for it to settle. */
    async function open() {
      while (gates.length === 0) await tick();
      gates.shift()!();
      await tick();
    }
    return { store, inner, open };
  }

  const one = (store: TransitionStore<string>, id: string, before: string, after: string, extra: Partial<TransitionCommandOptions<string>> = {}) =>
    transitionCommand<string>({ label: `set ${id}`, describe: plain, store, transitions: [{ id, before, after }], ...extra });

  it("shows each press on the same call, before the deferred store answers", async () => {
    const { store, inner, open } = gatedStore([["a", "0"]]);
    const history = createHistory();
    const running = history.run(one(store, "a", "0", "1"));
    expect(inner.showCalls).toEqual([[{ id: "a", expected: "0", next: "1" }]]);
    expect(history.state).toMatchObject({ undoLabel: "set a", busy: true });
    const undoing = history.undo();
    expect(inner.showCalls.at(-1)).toEqual([{ id: "a", expected: "1", next: "0" }]);
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "set a" });
    const redoing = history.redo();
    expect(inner.showCalls.at(-1)).toEqual([{ id: "a", expected: "0", next: "1" }]);
    expect(inner.showCalls).toHaveLength(3);
    expect(inner.commitCalls).toEqual([]);
    await open();
    await open();
    await open();
    await Promise.all([running, undoing, redoing]);
    expect(inner.get("a")).toBe("1");
    expect(inner.commitCalls.map((c) => c.context)).toEqual([
      { direction: "execute", previewed: true },
      { direction: "undo", previewed: true },
      { direction: "execute", previewed: true },
    ]);
    expect(history.state).toMatchObject({ undoLabel: "set a", canRedo: false, busy: false });
  });

  it("with shown, skips the first execute's show but still tells the commit it was previewed", async () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const history = createHistory();
    await history.run(one(store, "a", "0", "1", { shown: true }));
    expect(store.showCalls).toEqual([]);
    await history.undo();
    await history.redo();
    expect(store.showCalls).toEqual([
      [{ id: "a", expected: "1", next: "0" }],
      [{ id: "a", expected: "0", next: "1" }],
    ]);
    expect(store.commitCalls.map((c) => c.context)).toEqual([
      { direction: "execute", previewed: true },
      { direction: "undo", previewed: true },
      { direction: "execute", previewed: true },
    ]);
  });

  it("with shown, an undo pressed before the first write still pairs each commit with its own press", async () => {
    const { store, inner, open } = gatedStore([["a", "0"]]);
    const history = createHistory();
    const running = history.run(one(store, "a", "0", "1", { shown: true }));
    const undoing = history.undo();
    expect(inner.showCalls).toEqual([[{ id: "a", expected: "1", next: "0" }]]);
    await open();
    await open();
    await Promise.all([running, undoing]);
    expect(inner.commitCalls.map((c) => c.context)).toEqual([
      { direction: "execute", previewed: true },
      { direction: "undo", previewed: true },
    ]);
    expect(inner.get("a")).toBe("0");
  });

  it("tells the commit nothing was previewed when the store cannot show", async () => {
    const inner = memoryTransitionStore<string>([["a", "0"], ["b", "0"]]);
    const contexts: unknown[] = [];
    const noShow: TransitionStore<string> = {
      commit: (changes, context) => {
        contexts.push(context);
        return inner.commit(changes);
      },
    };
    const history = createHistory();
    await history.run(one(noShow, "a", "0", "1"));
    await history.undo();
    await history.run(one(noShow, "b", "0", "1", { shown: true }));
    await history.undo();
    expect(contexts).toEqual([
      { direction: "execute", previewed: false },
      { direction: "undo", previewed: false },
      { direction: "execute", previewed: true },
      { direction: "undo", previewed: false },
    ]);
    expect(inner.get("a")).toBe("0");
    expect(inner.get("b")).toBe("0");
  });

  it("calling execute or undo directly, with no press, commits as not previewed", async () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const command = one(store, "a", "0", "1");
    await command.execute();
    await command.undo();
    expect(store.commitCalls.map((c) => c.context)).toEqual([
      { direction: "execute", previewed: false },
      { direction: "undo", previewed: false },
    ]);
  });

  it("a first execute that applies nothing covers nothing afterwards", async () => {
    const stale = memoryTransitionStore<string>([["a", "elsewhere"]]);
    const skipped = one(stale, "a", "0", "1");
    expect((await skipped.execute())?.kind).toBe("skipped");
    expect(skipped.transitions).toEqual([]);

    const broken = memoryTransitionStore<string>([["a", "0"]]);
    broken.failNext("a");
    const failed = one(broken, "a", "0", "1");
    await expect(failed.execute()).rejects.toThrow("execute:0/1 stale 0 failed 1");
    expect(failed.transitions).toEqual([]);

    const rejecting = one({ commit: () => Promise.reject(new Error("network")) }, "a", "0", "1");
    await expect(rejecting.execute()).rejects.toThrow("network");
    expect(rejecting.transitions).toEqual([]);
  });

  it("a redo whose execute throws keeps its transitions for a retry", async () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const command = one(store, "a", "0", "1");
    await command.execute();
    await command.undo();
    store.failNext("a");
    await expect(command.execute()).rejects.toThrow();
    expect(command.transitions.map((t) => t.id)).toEqual(["a"]);
  });

  it("a coalesced stroke whose second part fails undoes only the first part's ids", async () => {
    const { store, inner, open } = gatedStore([["a", "0"], ["b", "0"]]);
    const history = createHistory();
    const stroke = { coalesceKey: "stroke", relabel: (m: readonly Transition<string>[]) => `Paint ${m.length}` };
    const first = history.run(one(store, "a", "0", "1", stroke));
    const second = history.run(one(store, "b", "0", "1", stroke));
    expect(history.state.undoLabel).toBe("Paint 2");
    await open(); // a lands
    inner.failNext("b");
    await open(); // b fails
    await Promise.all([first, second]);
    expect(history.state).toMatchObject({ undoLabel: "Paint 2", canUndo: true });
    const undoing = history.undo();
    await open();
    expect(await undoing).toEqual({ status: "done", label: "Paint 2" });
    expect(inner.commitCalls.at(-1)?.changes).toEqual([{ id: "a", expected: "1", next: "0" }]);
    expect([inner.get("a"), inner.get("b")]).toEqual(["0", "0"]);
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "Paint 2" });
  });

  it("a coalesced group undone mid-stroke previews every part and undoes what landed", async () => {
    const { store, inner, open } = gatedStore([["a", "0"], ["b", "0"]]);
    const history = createHistory();
    const first = history.run(one(store, "a", "0", "1", { coalesceKey: "k" }));
    const second = history.run(one(store, "b", "0", "1", { coalesceKey: "k" }));
    const undoing = history.undo();
    expect(inner.showCalls.at(-1)).toEqual([
      { id: "a", expected: "1", next: "0" },
      { id: "b", expected: "1", next: "0" },
    ]);
    await open();
    await open();
    await open();
    await Promise.all([first, second, undoing]);
    expect([inner.get("a"), inner.get("b")]).toEqual(["0", "0"]);
    // One store commit for the whole group's undo.
    expect(inner.commitCalls).toHaveLength(3);
    expect(inner.commitCalls[2].context).toEqual({ direction: "undo", previewed: true });
    const redoing = history.redo();
    await open();
    await redoing;
    expect([inner.get("a"), inner.get("b")]).toEqual(["1", "1"]);
  });

  it("a group that cancels out at the press drops the entry and the part still runs", async () => {
    const { store, inner, open } = gatedStore([["a", "0"]]);
    const history = createHistory();
    const first = history.run(one(store, "a", "0", "1", { coalesceKey: "k" }));
    const second = history.run(one(store, "a", "1", "0", { coalesceKey: "k" }));
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false });
    await open();
    await open();
    await Promise.all([first, second]);
    expect(inner.commitCalls).toHaveLength(2);
    expect(inner.get("a")).toBe("0");
    expect(history.state.canUndo).toBe(false);
  });

  it("drops a coalesced entry once every part has failed", async () => {
    const { store, inner, open } = gatedStore([["a", "0"], ["b", "0"]]);
    const history = createHistory();
    const first = history.run(one(store, "a", "0", "1", { coalesceKey: "k" }));
    const second = history.run(one(store, "b", "0", "1", { coalesceKey: "k" }));
    inner.failNext("a");
    await open();
    inner.failNext("b");
    await open();
    await Promise.all([first, second]);
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("a merged group is a transition command that redoes through its own execute", async () => {
    const store = memoryTransitionStore<string>([["a", "0"], ["b", "0"]]);
    const history = createHistory();
    const first = one(store, "a", "0", "1", { coalesceKey: "k" });
    const merged = first.merge!(one(store, "b", "0", "1", { coalesceKey: "k" }));
    expect(merged && isTransitionCommand(merged)).toBe(true);
    await history.run(first);
    await history.run(one(store, "b", "0", "1", { coalesceKey: "k" }));
    await history.undo();
    await history.redo();
    expect([store.get("a"), store.get("b")]).toEqual(["1", "1"]);
  });

  it("shows ids a press did not preview right before committing them", async () => {
    // An undo retry that finishes restores ids to the entry after a redo was already pressed.
    const { store, inner, open } = gatedStore([["a", "0"], ["b", "0"]]);
    const history = createHistory();
    const command = transitionCommand<string>({
      label: "ab",
      describe: plain,
      store,
      transitions: [
        { id: "a", before: "0", after: "1" },
        { id: "b", before: "0", after: "1" },
      ],
    });
    const running = history.run(command);
    await open();
    await running;
    inner.failNext("b");
    const firstUndo = history.undo();
    await open();
    expect((await firstUndo).status).toBe("failed");
    const retry = history.undo();
    const redoing = history.redo();
    expect(inner.showCalls.at(-1)).toEqual([{ id: "b", expected: "0", next: "1" }]);
    const showsBefore = inner.showCalls.length;
    await open();
    await retry;
    expect(command.transitions.map((t) => t.id)).toEqual(["a", "b"]);
    await open();
    await redoing;
    expect(inner.showCalls.slice(showsBefore)).toEqual([[{ id: "a", expected: "0", next: "1" }]]);
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: true });
    expect([inner.get("a"), inner.get("b")]).toEqual(["1", "1"]);
  });

  it("a composite entry previews both commands, the second first on undo", async () => {
    const store = memoryTransitionStore<string>([["a", "0"]]);
    const history = createHistory();
    const previews: string[] = [];
    await history.run(one(store, "a", "0", "1", { coalesceKey: "k" }));
    await history.run({
      label: "plain",
      coalesceKey: "k",
      execute() {},
      undo() {},
      preview: (direction) => {
        previews.push(`plain:${direction}:${store.showCalls.length}`);
      },
    });
    const showsBefore = store.showCalls.length;
    previews.length = 0;
    await history.undo();
    // The plain command previews before the transition command's show is recorded.
    expect(previews).toEqual([`plain:undo:${showsBefore}`]);
    expect(store.showCalls.length).toBe(showsBefore + 1);
    previews.length = 0;
    await history.redo();
    expect(previews).toEqual([`plain:execute:${showsBefore + 2}`]);
  });
});

describe("a failed step cancels later presses of the same entry", () => {
  const msg = () => "msg";

  /**
   * A memory store with a screen, the way an app uses one: show puts next on
   * screen; a previewed commit shows the stored value for every id that did
   * not apply; a commit that was not previewed shows the stored value for all.
   */
  function appStore(initial: [string, number][]) {
    const inner = memoryTransitionStore<number>(initial);
    const screen = new Map<string, number | undefined>(initial);
    const store: TransitionStore<number> = {
      show(changes) {
        inner.show(changes);
        for (const c of changes) screen.set(c.id, c.next);
      },
      async commit(changes, context) {
        const results = await inner.commit(changes, context);
        for (const r of results) if (r.status !== "applied" || !context?.previewed) screen.set(r.id, inner.get(r.id));
        return results;
      },
    };
    return { store, inner, screen };
  }

  const cmd = (store: TransitionStore<number>, transitions: Transition<number>[], extra: Partial<TransitionCommandOptions<number>> = {}) =>
    transitionCommand<number>({ label: "A", store, describe: msg, transitions, ...extra });

  it("an undo that partly fails, with a redo pressed behind it, keeps the entry undoable and the screen true", async () => {
    const { store, inner, screen } = appStore([["x", 0], ["y", 0]]);
    const history = createHistory();
    const a = cmd(store, [
      { id: "x", before: 0, after: 1 },
      { id: "y", before: 0, after: 1 },
    ]);
    await history.run(a);
    inner.failNext("y");
    const undoing = history.undo();
    const redoing = history.redo();
    expect((await undoing).status).toBe("failed");
    expect(await redoing).toEqual({ status: "skipped", label: "A" });
    expect([inner.get("x"), inner.get("y")]).toEqual([0, 1]);
    expect([screen.get("x"), screen.get("y")]).toEqual([0, 1]);
    expect(history.state).toMatchObject({ undoLabel: "A", canRedo: false });
    expect(history.state.lastAction).toEqual({ kind: "undo", label: "A", status: "failed" });
    // The retry covers what is left: y.
    expect(await history.undo()).toEqual({ status: "done", label: "A" });
    expect([inner.get("x"), inner.get("y")]).toEqual([0, 0]);
    expect([screen.get("x"), screen.get("y")]).toEqual([0, 0]);
    expect(history.state.redoLabel).toBe("A");
  });

  it("a redo that throws, with an undo and a redo pressed behind it, goes back to redo and the screen shows the store", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    await history.undo();
    inner.failNext("x");
    const first = history.redo();
    const undoing = history.undo();
    const second = history.redo();
    expect((await first).status).toBe("failed");
    expect(await undoing).toEqual({ status: "skipped", label: "A" });
    expect(await second).toEqual({ status: "skipped", label: "A" });
    expect(inner.get("x")).toBe(0);
    expect(screen.get("x")).toBe(0);
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "A" });
    expect(history.state.lastAction).toEqual({ kind: "redo", label: "A", status: "failed" });
    expect(await history.redo()).toEqual({ status: "done", label: "A" });
    expect([inner.get("x"), screen.get("x")]).toEqual([1, 1]);
  });

  it("an undo that throws, with a redo and an undo pressed behind it, stays undoable and the screen shows the store", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    inner.failNext("x");
    const first = history.undo();
    const redoing = history.redo();
    const second = history.undo();
    expect((await first).status).toBe("failed");
    expect((await redoing).status).toBe("skipped");
    expect((await second).status).toBe("skipped");
    expect([inner.get("x"), screen.get("x")]).toEqual([1, 1]);
    expect(history.state).toMatchObject({ undoLabel: "A", canRedo: false });
    expect(await history.undo()).toEqual({ status: "done", label: "A" });
    expect([inner.get("x"), screen.get("x")]).toEqual([0, 0]);
  });

  it("a run that is skipped, with an undo pressed behind it, re-shows what the store holds", async () => {
    const { store, inner, screen } = appStore([["x", 7]]);
    const history = createHistory();
    const running = history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    const undoing = history.undo();
    expect(screen.get("x")).toBe(0);
    expect((await running).status).toBe("skipped");
    expect(await undoing).toEqual({ status: "skipped", label: "A" });
    expect([inner.get("x"), screen.get("x")]).toEqual([7, 7]);
    expect(history.state).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("a commit queued behind a step that did not fully apply is told it was not previewed", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    // Someone else put x back; the undo finds it stale, the redo then applies.
    inner.set("x", 0);
    const undoing = history.undo();
    const redoing = history.redo();
    expect((await undoing).status).toBe("skipped");
    expect((await redoing).status).toBe("done");
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: false });
    expect([inner.get("x"), screen.get("x")]).toEqual([1, 1]);
  });

  it("a merge that cancels out does not let the next run fold into the older entry", async () => {
    const { store, inner } = appStore([["x", 0], ["z", 0]]);
    const history = createHistory();
    const paint = (label: string, id: string, before: number, after: number) =>
      transitionCommand<number>({ label, store, describe: msg, coalesceKey: "paint", transitions: [{ id, before, after }] });
    await history.run(paint("E0", "z", 0, 1));
    await history.undo();
    await history.redo();
    await history.run(paint("p1", "x", 0, 1));
    await history.run(paint("p2", "x", 1, 0));
    await history.run(paint("p3", "x", 0, 5));
    expect(history.state.undoLabel).toBe("p3");
    await history.undo();
    expect([inner.get("z"), inner.get("x")]).toEqual([1, 0]);
    expect(history.state.undoLabel).toBe("E0");
  });

  it("drops a group whose parts all failed even while unrelated work is queued", async () => {
    const { store, inner } = appStore([["x", 9], ["y", 9], ["q", 0]]);
    const history = createHistory();
    const part = (label: string, id: string, key: string) =>
      transitionCommand<number>({ label, store, describe: msg, coalesceKey: key, transitions: [{ id, before: 0, after: 1 }] });
    const runs = [history.run(part("p1", "x", "k")), history.run(part("p2", "y", "k")), history.run(part("q", "q", "other"))];
    await Promise.all(runs);
    expect(history.state.undoLabel).toBe("q");
    await history.undo();
    expect(history.state).toMatchObject({ canUndo: false, redoLabel: "q" });
    expect(inner.get("q")).toBe(0);
  });

  it("a failed undo's correction makes a newer press by another command on the same id commit as not previewed", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    inner.failNext("x");
    const undoing = history.undo();
    const runB = history.run(cmd(store, [{ id: "x", before: 1, after: 2 }], { label: "B" }));
    expect(screen.get("x")).toBe(2);
    expect((await undoing).status).toBe("failed");
    expect((await runB).status).toBe("done");
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: false });
    expect([inner.get("x"), screen.get("x")]).toEqual([2, 2]);
  });

  it("a reconcile makes a newer press by another command on the same id commit as not previewed", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    inner.failNext("x");
    const results = await Promise.all([
      history.undo(),
      history.redo(),
      history.run(cmd(store, [{ id: "x", before: 1, after: 2 }], { label: "B" })),
    ]);
    expect(results.map((r) => r.status)).toEqual(["failed", "skipped", "done"]);
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: false });
    expect([inner.get("x"), screen.get("x")]).toEqual([2, 2]);
  });

  it("a correction also unmarks a caller-shown first execute of another command", async () => {
    const { store, inner, screen } = appStore([["x", 0]]);
    const history = createHistory();
    await history.run(cmd(store, [{ id: "x", before: 0, after: 1 }]));
    inner.failNext("x");
    const undoing = history.undo();
    // The chip flips as it is clicked; the caller shows it, not the store.
    screen.set("x", 2);
    const runB = history.run(cmd(store, [{ id: "x", before: 1, after: 2 }], { label: "B", shown: true }));
    await Promise.all([undoing, runB]);
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: false });
    expect([inner.get("x"), screen.get("x")]).toEqual([2, 2]);
  });

  it("a composite whose second undo throws keeps the first command's previews in step", async () => {
    const { store, inner, screen } = appStore([["a", 0]]);
    const history = createHistory();
    let failUndo = true;
    await history.run(cmd(store, [{ id: "a", before: 0, after: 1 }], { coalesceKey: "k" }));
    await history.run({
      label: "plain",
      coalesceKey: "k",
      execute() {},
      undo() {
        if (failUndo) {
          failUndo = false;
          throw new Error("offline");
        }
      },
    });
    expect((await history.undo()).status).toBe("failed");
    expect(history.state.undoLabel).toBe("plain");
    expect(await history.undo()).toEqual({ status: "done", label: "plain" });
    expect([inner.get("a"), screen.get("a")]).toEqual([0, 0]);
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "undo", previewed: true });
    expect(await history.redo()).toEqual({ status: "done", label: "plain" });
    expect(inner.commitCalls.at(-1)?.context).toEqual({ direction: "execute", previewed: true });
    expect([inner.get("a"), screen.get("a")]).toEqual([1, 1]);
  });
});
