# @austencloud/undo

Async command history with undo and redo, for apps whose changes are writes to
a server. Every press shows its result at once; the writes behind the presses
run one at a time; each reports done, partial, skipped or failed; the history
keeps what applied so Undo takes back exactly that.

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
    store: {
      show: (changes) => screen.showTags(changes), // at the press: the chip changes now
      commit: (changes, context) => api.setTagsIfUnchanged(changes, { previewed: context?.previewed ?? false }),
    },
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

`limit` must be a whole number of 0 or more; anything else throws a
`RangeError` from `createHistory`.

## Outcomes

A command returns nothing when everything applied, `{ kind: "partial", message }`
when some of it did (the entry stays, covering only that part), or
`{ kind: "skipped", message }` when none did because the world moved on
(nothing is kept). Throwing means the write failed: a run that throws leaves
nothing undoable, and an undo or redo that throws moves its entry back so the
person can retry. `run`, `undo` and `redo` never reject.

## Instant presses

The stacks move at the press. `run` puts the command on the undo stack (or
folds it into the top entry), `undo` moves the top entry to the redo stack and
`redo` moves it back, all before the call returns, so `canUndo`, `canRedo`,
the labels and `lastAction` are right on the same frame as the click or key.
An undo or redo press sets `lastAction` to `{ kind, label, status: "pending" }`;
show `pending` exactly like `done` ("Undone: Add Fire").

The writes are still queued and run one at a time in press order, so an undo
pressed while its own run is still writing simply runs after that run. When a
step settles it only corrects what turned out differently:

- a run that was skipped or threw is removed from whichever stack holds it;
- an undo that throws goes back on top of the undo stack, covering what is
  left to retry, even if a newer run cleared redo meanwhile (the undo did not
  happen, so it is still undoable); one that was skipped is dropped from redo;
- a redo that throws goes back on top of the redo stack, or is dropped when a
  newer change cleared redo since; one that was skipped is dropped.

A failure cancels every later press of the same entry still queued behind it
(a run that applied nothing counts as a failure here). Each cancelled step
answers `{ status: "skipped" }` without calling the command and without
touching `lastAction`, so the failure stays the visible message. The entry is
placed by the failed step alone, as above, wherever the cancelled presses had
moved it. If anything was cancelled, the history then calls the command's
`reconcile()`, which drops the cancelled previews and re-shows what the store
actually holds.

A settle replaces `lastAction` and `lastMessage` only when no newer press has
happened since, so a late `done` never overwrites a newer `pending`. `partial`,
`skipped` and `failed` always surface. `undo` and `redo` with nothing to take
answer `{ status: "empty" }` at once and queue nothing. `busy` is true while
any write is queued or running. `clear()` forgets everything, discards the
results of work still in flight and stops queued runs, undos and redos from
executing at all.

A command can implement `preview(direction)` (`"execute"` or `"undo"`) to put
the coming change on screen at the press, `reconcile()` to put the screen
right after its later presses were cancelled, and `discardPreviews()` to drop
the previews of presses that `clear()` stopped. `clear()` calls
`discardPreviews()` synchronously and never `reconcile()`, so nothing from
before the clear (a signed-out account, a closed document) reaches the screen
later. The history calls all three inside a try/catch and rethrows a failure
asynchronously. Without `preview`, nothing
changes on screen until the work runs.

## Guarded transitions

`transitionCommand` writes through a store that reports one result per change,
matched by id: `applied`, `stale` (the stored value is no longer what the
command expects, so it is left alone) or `failed`. If an undo fails on some
ids, the entry stays on the undo stack and covers only those ids, so one more
undo retries exactly them; once it finishes, redo re-applies everything that
was undone. A store must resolve, not reject, once any write has landed. A
first execute that applies nothing leaves the command covering nothing.

For instant presses give the store a `show` method. The four pieces work
together:

| Piece | Who sets or calls it | What it means |
| --- | --- | --- |
| `preview(direction)` | The history, on the command, at every run, undo and redo press | Put the coming change on screen now. A transition command does it through `store.show`. |
| `store.show(changes)` | The command's `preview` and `reconcile` | Put each change's `next` on screen, synchronously, without writing. Also called just before a commit for ids its press did not cover (a retried undo that finishes restores ids). |
| `shown: true` | The app, as a `transitionCommand` option | The caller already put the first execute on screen (a chip that flips as it is clicked). That press's preview shows nothing, and its commit is told `previewed: true`. |
| `previewed` | The command, in `commit(changes, { direction, previewed })` | `true`: this press put `next` on screen for these ids and nothing has invalidated it since. `false`: the store puts applied values on screen itself. It is false when the store has no `show`, when `execute` or `undo` is called directly with no press, and for every press still waiting to commit (of any transition command, on any store) at the moment any step ends with ids that did not apply (stale or failed, in a partial, skipped or failed outcome) or any command reconciles. That invalidation is deliberately coarse, since ids from different stores can collide; the cost is one extra screen write. |

The store rule: on a previewed commit, leave applied ids alone and show the
stored value for every id that did not apply, failed ids included (a stale id
shows the `current` it found; a failed id shows `expected`). On a commit that
was not previewed, show the stored value for every id. A transition command's
`reconcile()` shows the truth of its last settled step the same way: applied
ids its `next`, failed ids its `expected`, stale ids their `current`.

`coalesceKey` folds back-to-back commands into one entry (every item painted in
one drag). Folding happens at the press, before either command has executed:
transition commands merge into a group that reads its parts' transitions as
they settle (per id, the first part's before and the last part's after), so a
part that fails drops out and Undo takes back only what landed. Each part
executes as its own queued run; the group's `execute` runs only for a redo. A
group that cancels out at the press removes the entry while its parts still
run, and the next run starts a new entry rather than folding into the older
one below. Once every part of a group has applied nothing and no part or press
of that group is still queued, the history drops the group's entry. Transition commands that share a
key are folded together even when each has its own store object, so a key must
only be shared by commands that write through equivalent stores; anything else
becomes a composite entry, whose preview forwards to both commands (in reverse
for undo). `memoryTransitionStore` is an in-memory store for tests; it records
every `show` and `commit` call.

## Keyboard

`attachUndoKeyboard` ignores key repeat, events something else already
handled (`defaultPrevented`), and IME composition. It treats text-entry inputs,
textareas, selects, contenteditable elements and elements with a `textbox`,
`searchbox` or `combobox` role as editable and leaves those to the browser;
range sliders, checkboxes and buttons are not editable. Pass `isEditable` to
change that, and `onResult` to hear what each undo or redo did.
