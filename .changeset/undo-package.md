---
"@austencloud/undo": minor
---

New package: an async command history with undo and redo. Commands run one at
a time and report done, partial, skipped or failed; `transitionCommand` turns
per-item before/after values into a command whose store writes only where the
stored value still matches, so a change made elsewhere is left alone;
`attachUndoKeyboard` binds Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y;
`createHistoryState` gives Svelte 5 a reactive view of the history.
