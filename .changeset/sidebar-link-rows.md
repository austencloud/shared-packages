---
"@austencloud/sidebar": minor
---

Link rows, label-only rows, row depth, a top inset, and localized control names.

- `href` (+ `download`) on `Section` and `ModuleDefinition` renders the row as a
  real `<a href>` with `aria-current="page"` when active, so a host's navigation
  stays crawlable. The click still fires `onSectionChange` / `onModuleChange`;
  a module with sections and an `href` still peeks when tapped in the expanded
  tree. Modified clicks are left to the browser.
- `Section.icon` is optional. A section without an icon is a text row in the
  expanded tree and is skipped in the rail.
- `Section.depth` (`0 | 1`) indents a sub-row.
- `top: var(--sidebar-top, 0px)` lets a host with a fixed header sit the rail
  under it.
- `navigationLabel`, `homeLabel`, `pinLabel` and `collapseLabel` props name the
  package-owned controls (folded in from a downstream patch).
