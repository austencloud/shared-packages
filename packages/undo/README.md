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

- a run that was skipped or threw is removed from whichever stack holds it,
  and any undo or redo of it still queued does not run;
- an undo that throws goes back on top of the undo stack, even if a newer run
  cleared redo meanwhile (the undo did not happen, so it is still undoable);
  one that was skipped is dropped from redo;
- a redo that throws goes back on top of the redo stack, or is dropped when a
  newer change cleared redo since; one that was skipped is dropped.

A settle replaces `lastAction` and `lastMessage` only when no newer press has
happened since, so a late `done` never overwrites a newer `pending`. `partial`,
`skipped` and `failed` always surface. `undo` and `redo` with nothing to take
answer `{ status: "empty" }` at once and queue nothing. `busy` is true while
any write is queued or running. `clear()` forgets everything, discards the
results of work still in flight and stops queued runs, undos and redos from
executing at all.

A command can implement `preview(direction)` (`"execute"` or `"undo"`) to put
the coming change on screen at the press. The history calls it inside a
try/catch and rethrows a failure asynchronously. Without it, nothing changes
on screen until the work runs.

## Guarded transitions

`transitionCommand` writes through a store that reports one result per change,
matched by id: `applied`, `stale` (the stored value is no longer what the
command expects, so it is left alone) or `failed`. If an undo fails on some
ids, the entry stays on the undo stack and covers only those ids, so one more
undo retries exactly them; once it finishes, redo re-applies everything that
was undone. A store must resolve, not reject, once any write has landed. A
first execute that applies nothing leaves the command covering nothing.

For instant presses give the store a `show(changes)` method that puts each
change's `next` on screen, synchronously, without writing. The command's
`preview` calls it at every press with the changes that press will commit.
`commit(changes, context)` then receives `{ direction, previewed }`:
`previewed: true` means the screen already shows `next` for these ids, so the
store only corrects the ones that did not apply (a stale id shows what the
server holds; a failed id goes back, if nothing newer has changed it since).
`previewed: false` means the store puts applied values on screen itself, as a
store without `show` always does. If the command's list grew between press and
commit (a retried undo that finishes restores ids), `show` is called for the
new ids just before the commit. Pass `shown: true` when the caller already put
the first execute on screen (a chip that flips as it is clicked): its preview
then shows nothing and its commit is told `previewed: true`.

`coalesceKey` folds back-to-back commands into one entry (every item painted in
one drag). Folding happens at the press, before either command has executed:
transition commands merge into a group that reads its parts' transitions as
they settle (per id, the first part's before and the last part's after), so a
part that fails drops out and Undo takes back only what landed. Each part
executes as its own queued run; the group's `execute` runs only for a redo. A
group that cancels out at the press removes the entry while its parts still
run. Once every part of a group has applied nothing and no other work is
queued, the history drops the group's entry. Transition commands that share a
key are folded together even when each has its own store object, so a key must
only be shared by commands that write through equivalent stores; anything else
becomes a composite entry, whose preview forwards to both commands (in reverse
for undo). `memoryTransitionStore` is an in-memory store for tests; it records
every `show` and `commit` call.

One limit: when an undo or redo is pressed while its entry's first write is
still running and that write then applies nothing, the queued undo or redo does
not run, so its preview is never committed. The store's correction for the
failed or stale first write is the place to put that id right (it sees that a
newer press touched the id).

## Keyboard

`attachUndoKeyboard` ignores key repeat, events something else already
handled (`defaultPrevented`), and IME composition. It treats text-entry inputs,
textareas, selects, contenteditable elements and elements with a `textbox`,
`searchbox` or `combobox` role as editable and leaves those to the browser;
range sliders, checkboxes and buttons are not editable. Pass `isEditable` to
change that, and `onResult` to hear what each undo or redo did.
