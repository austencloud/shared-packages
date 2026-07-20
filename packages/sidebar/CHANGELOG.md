# @austencloud/sidebar

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
