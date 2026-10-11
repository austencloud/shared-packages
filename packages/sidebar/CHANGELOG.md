# @austencloud/sidebar

## 1.1.0

### Minor Changes

- a8250f9: Link rows, label-only rows, row depth, a top inset, and localized control names.

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

## 1.0.1

### Patch Changes

- 9211318: Fix the hover-expand rail staying open after a tab click.

  Clicking a module or tab focuses its button, and that click-focus was counted as
  a hold-open reason. The pointermove backstop — the only close path left when a
  navigation view transition swallows the nav's real `pointerleave` — bailed out on
  it, so the overlay hung open until an unrelated click blurred the button.

  Hold-open now requires a _keyboard_ focus (`:focus-visible`), and all three close
  paths (pointerleave, the pointermove backstop, the guard-cleared effect) share
  one `shouldStayOpen` predicate so none can be stricter than the others.
