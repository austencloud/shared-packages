// A Svelte 5 view of a History. Reading any getter inside an effect or a
// template subscribes that effect to the history, so a component re-renders
// when the stacks change. Plain .ts, no runes: createSubscriber does the
// wiring and starts listening only while something is actually watching.

import { createSubscriber } from "svelte/reactivity";
import type { History, HistoryState } from "./types.js";

export function createHistoryState(history: History): HistoryState {
  const subscribe = createSubscriber((update) => history.subscribe(update));
  function read<K extends keyof HistoryState>(key: K): HistoryState[K] {
    subscribe();
    return history.state[key];
  }
  return {
    get canUndo() {
      return read("canUndo");
    },
    get canRedo() {
      return read("canRedo");
    },
    get undoLabel() {
      return read("undoLabel");
    },
    get redoLabel() {
      return read("redoLabel");
    },
    get busy() {
      return read("busy");
    },
    get lastMessage() {
      return read("lastMessage");
    },
    get lastAction() {
      return read("lastAction");
    },
  };
}
