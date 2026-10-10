import { describe, expect, it } from "vitest";
import { createHistory } from "./history.js";
import { createHistoryState } from "./history-state.js";

describe("createHistoryState", () => {
  it("reads the live history state through getters", async () => {
    const history = createHistory();
    const view = createHistoryState(history);
    expect(view.canUndo).toBe(false);
    expect(view.undoLabel).toBeNull();
    await history.run({ label: "A", execute() {}, undo() {} });
    expect(view.canUndo).toBe(true);
    expect(view.undoLabel).toBe("A");
    expect(view.lastAction).toEqual({ kind: "run", label: "A", status: "done" });
    history.clear();
    expect(view.canUndo).toBe(false);
  });
});
