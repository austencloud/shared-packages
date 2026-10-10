---
"@austencloud/undo": minor
---

Instant presses. `run`, `undo` and `redo` now move the stacks, the labels and
`lastAction` at the press, before the write settles; the writes still run one
at a time in press order, and a settle only corrects what turned out
differently (a failed undo or redo moves back, a run that applied nothing is
removed). `lastAction.status` gains `"pending"` for an undo or redo whose write
is still running; show it like `"done"`. Commands can implement
`preview(direction)` to change the screen at the press. `transitionCommand`
calls the new optional `store.show(changes)` for that, tells `commit` whether
the press was previewed through a new optional second argument, and takes a
`shown` option for a first execute the caller already put on screen.
Coalescing now merges at the press into a group that reads its parts'
transitions as they settle. A step that fails cancels every later press of the
same entry still queued behind it; the new optional `Command.reconcile()` (which
`transitionCommand` implements) then puts the screen back to what the store
holds. `clear()` also reconciles a command whose queued press it drops. Any
step that ends with ids not applied, and any reconcile, marks every transition
press still waiting as not previewed, so its commit re-shows what it applied.
