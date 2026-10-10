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
transitions as they settle.
