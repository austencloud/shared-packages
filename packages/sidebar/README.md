# @austencloud/sidebar

Hover-expand overlay sidebar for Svelte 5. A 64px icon rail that content
reserves; on hover it floats out to the expanded width as an **overlay** (no
content reflow); a pin button locks it open (push layout). One morphing
module/section tree in both states — no layout shift. Everything domain-specific
(i18n, haptics, auth, feature flags, brand, footer, account) is host-supplied
through props and snippet slots.

## Install

```bash
pnpm add @austencloud/sidebar
```

Import the default tokens once at your app root (optional — every `var()` has an
inline fallback, and a host that already provides `--theme-*` / `--duration-*`
overrides them):

```css
@import '@austencloud/sidebar/css/sidebar-tokens.css';
```

## Interaction model

- **Rail** (unpinned, default): 64px icon rail. Content reserves `railWidth`.
- **Hover**: on pointer hover the rail floats out to `expandedWidth` as an
  overlay *above* content. The reserved width does not change, so nothing
  reflows. Hover-expand is gated to `(hover: hover) and (pointer: fine)` devices.
- **Pinned**: the pin button locks the sidebar open; reserved width becomes
  `expandedWidth` and content is offset by it (push layout). Persisted to
  `pinStorageKey`.

### Reserved-width contract

The component sets `--sidebar-reserved-width` on its `<nav>` and calls
`onReservedWidthChange(px)`. Offset your content by it:

```css
.app-content { margin-inline-start: var(--sidebar-reserved-width, 64px); }
```

The hover overlay floats above content, so `--sidebar-reserved-width` only
changes on pin/unpin — never on hover.

## Usage

```svelte
<script lang="ts">
  import { Sidebar, SidebarAccount } from '@austencloud/sidebar';
  import type { ModuleDefinition } from '@austencloud/sidebar';

  let currentModule = $state('home');
  let currentSection = $state('overview');

  const modules: ModuleDefinition[] = [
    { id: 'home', label: 'Home', icon: '<i class="fas fa-house"></i>', isMain: true, sections: [] },
    { id: 'library', label: 'Library', icon: '<i class="fas fa-book"></i>', isMain: true, sections: [
      { id: 'all', label: 'All', icon: '<i class="fas fa-list"></i>' },
      { id: 'starred', label: 'Starred', icon: '<i class="fas fa-star"></i>' },
    ]},
  ];
</script>

<Sidebar
  {modules}
  {currentModule}
  {currentSection}
  pinStorageKey="my-app-sidebar"
  homeHref="/"
  brandLead="TKA"
  brandRest=" Composer"
  onModuleChange={(id) => (currentModule = id)}
  onSectionChange={(id) => (currentSection = id)}
>
  {#snippet account(expanded)}
    <SidebarAccount
      variant={expanded ? 'expanded' : 'collapsed'}
      isAuthenticated={!!user}
      displayName={user?.name}
      onclick={openAccountMenu}
    >
      {#snippet avatar()}<img src={user?.photo} alt="" />{/snippet}
    </SidebarAccount>
  {/snippet}

  {#snippet footer(expanded)}
    <!-- host-specific actions (settings, support, etc.) -->
  {/snippet}
</Sidebar>
```

### Brand

- `brandLead` + `brandRest` (strings or snippets) get the shared slide-reveal:
  the lead stays solid and slides while the rest reveals via a `0fr→1fr` grid
  column and fades. Pass a leading space in `brandRest` (`" Composer"`) — it is
  preserved.
- `brand` (snippet) fully overrides the wordmark/home content (e.g. a logo
  badge). The pin button is package-owned and stays regardless.
- `homeHref` makes the brand an `<a>` to that route (an in-app path home).

## Props

| Prop | Type | Notes |
|---|---|---|
| `modules` | `ModuleDefinition[]` | Required. Nav data. |
| `currentModule` / `currentSection` | `string` | Active route. |
| `onModuleChange(id, targetSection?)` | fn | Navigate to a module. |
| `onSectionChange(sectionId)` | fn | Navigate to a section. |
| `onModuleContextMenu(id, e)` / `onSectionContextMenu(id, sectionId, e)` | fn | Host renders its own menu; the component `preventDefault`s. |
| `onModuleHover(id)` | fn | Prefetch hint on hover. |
| `pinned` | `boolean` (bindable) | Rail vs pinned. |
| `pinStorageKey` | `string \| null` | localStorage persistence key. |
| `railWidth` / `expandedWidth` | `number` | Reserved-width contract (px). Default 64 / 220. |
| `hoverIntent` | `{ openDelay?, closeDelay? }` | Timers. Default 50 / 300 ms. |
| `disableHoverExpand` | `boolean` | Rail behaves as click-to-pin only. |
| `holdOpen` | `boolean` | Keep the overlay open while a host popover/menu is showing. |
| `onReservedWidthChange(px)` | fn | Reserved width changed (pin/unpin). |
| `onHaptic()` | fn | Fired once per tap. |
| `translateLabel(id)` / `translateSectionLabel(id, sectionId, fallback)` | fn | i18n. |
| `filterSection(id, sectionId)` | fn | Visibility predicate (access / flags). |
| `getBadgeCount(id, sectionId?)` | fn | Badge counts. |
| `homeHref` | `string \| null` | Brand → home link. |
| `brandLead` / `brandRest` | `Snippet \| string` | Wordmark with shared slide-reveal. |
| `brand` | `Snippet<[expanded]>` | Full brand override (pin kept). |
| `renderIcon` | `Snippet<[name, size]>` | Icon renderer (else `{@html icon}`). |
| `beforeTree` / `account` / `footer` | `Snippet<[expanded]>` | Host slots. |
| `class` | `string` | Extra class on the `<nav>`. |

## Theming

Consumes `--theme-{panel-bg,stroke,stroke-strong,accent,accent-strong,text,
text-dim,card-bg,card-hover-bg,shadow}`, `--semantic-{error,info,success}`,
`--duration-{instant,fast,normal,emphasis}`, `--ease-out`, `--min-touch-target`,
`--font-size-*`, `--z-sidebar`. Every `var()` carries an inline fallback.
`css/sidebar-tokens.css` ships defaults for a bare consumer.
