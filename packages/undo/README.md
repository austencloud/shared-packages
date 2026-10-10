# @austencloud/undo

Async command history with undo and redo, for apps whose changes are writes to
a server. Commands run one at a time; each reports done, partial, skipped or
failed; the history keeps what applied so Undo takes back exactly that.

## Use

```ts
import { createHistory, transitionCommand, attachUndoKeyboard, createHistoryState } from "@austencloud/undo";

const history = createHistory({ limit: 100 });

// A change as per-item before/after values, written through a guarded store:
// the store replaces a value only where it still holds what the command expects.
await history.run(
  transitionCommand<string[]>({
    label: "Add Fire to 12 photos",
    transitions: items.map((item) => ({ id: item.id, before: item.tags, after: [...item.tags, "fire"] })),
    store: { commit: (changes) => api.setTagsIfUnchanged(changes) },
    equals: sameSet,
    describe: (report) => `${report.applied} of ${report.total} saved`,
  })
);

await history.undo(); // { status: "done" | "partial" | "skipped" | "failed" | "empty", label, message?, error? }

// Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, skipping text fields.
const detach = attachUndoKeyboard(history, { target: window });

// In Svelte 5: a reactive view for templates.
const view = createHistoryState(history); // view.canUndo, view.undoLabel, view.lastMessage ...
```

`limit` must be a finite number of 0 or more; anything else throws a
`RangeError` from `createHistory`.

## Outcomes

A command returns nothing when everything applied, `{ kind: "partial", message }`
when some of it did (the entry stays, covering only that part), or
`{ kind: "skipped", message }` when none did because the world moved on
(nothing is kept). Throwing means the write failed; the entry stays put so the
person can retry. `run`, `undo` and `redo` never reject.

## Guarded transitions

`transitionCommand` writes through a store that reports one result per change,
matched by id: `applied`, `stale` (the stored value is no longer what the
command expects, so it is left alone) or `failed`. If an undo fails on some
ids, the entry stays on the undo stack and covers only those ids, so one more
undo retries exactly them; once it finishes, redo re-applies everything that
was undone. A store must resolve, not reject, once any write has landed.

`coalesceKey` folds back-to-back commands into one entry (every item painted in
one drag). Only transition commands that share a store are folded together;
anything else becomes a composite entry. `clear()` forgets everything and
discards the results of work still in flight. `memoryTransitionStore` is an
in-memory store for tests.

## Keyboard

`attachUndoKeyboard` ignores key repeat, events something else already
handled (`defaultPrevented`), and IME composition. It treats text-entry inputs,
textareas, selects, contenteditable elements and elements with a `textbox`,
`searchbox` or `combobox` role as editable and leaves those to the browser;
range sliders, checkboxes and buttons are not editable. Pass `isEditable` to
change that, and `onResult` to hear what each undo or redo did.
