# Austencloud Shared Packages - Architecture Plan

## Vision

A collection of battle-tested, reusable packages that power all Austen Cloud applications. When starting a new project, you run `npm install @austencloud/...` and get production-ready components that work identically across all your apps.

**10-year goal:** These packages become so refined that they could be open-sourced as a Svelte component library others would pay to use.

---

## Package Hierarchy

```
@austencloud/
├── core/                    # Foundation - zero Svelte dependency
│   ├── theme-engine         # Luminance detection, CSS variable generation
│   ├── gesture-engine       # Touch/pointer gesture detection (vanilla JS)
│   └── animation-utils      # Easing functions, spring physics, timing
│
├── primitives/              # Low-level Svelte building blocks
│   ├── drawer              # Bottom/side sheet with swipe-to-dismiss
│   ├── modal               # Dialog with @starting-style animations
│   ├── toast               # Notification system
│   └── portal              # Render-to-body utility
│
├── components/              # Higher-level composed components
│   ├── media-spotlight     # Full-screen media viewer (THIS ONE)
│   ├── sidebar             # Collapsible navigation sidebar
│   ├── tag-input           # Tag creation/selection
│   └── confirmation        # Confirm dialogs with keyboard support
│
├── systems/                 # Complete feature systems
│   ├── backgrounds         # Animated canvas backgrounds (DONE)
│   ├── theme               # Theme system with CSS variables (DONE)
│   ├── onboarding          # First-run wizards, tooltips, tours
│   └── settings            # Settings panel framework
│
└── domain/                  # Domain-specific (may never be shared)
    └── tka/                # TKA-specific components (pictograph, etc.)
```

---

## Package Design Principles

### 1. Zero External Dependencies (Where Possible)

Bad:
```json
"dependencies": {
  "lodash": "^4.0.0",
  "date-fns": "^2.0.0",
  "embla-carousel": "^8.0.0"
}
```

Good:
```json
"dependencies": {},
"peerDependencies": {
  "svelte": "^5.0.0"
}
```

Every dependency is a future maintenance burden. Write the 50 lines yourself if it avoids a dependency.

### 2. CSS Variables Over Hardcoded Values

Bad:
```css
.spotlight-overlay {
  background: rgba(0, 0, 0, 0.95);
}
```

Good:
```css
.spotlight-overlay {
  background: var(--spotlight-backdrop, rgba(0, 0, 0, 0.95));
}
```

Every visual property should be overridable via CSS custom properties. This lets consuming apps customize without forking.

### 3. Composition Over Configuration

Bad:
```svelte
<MediaSpotlight
  showTags={true}
  showCrop={true}
  showDelete={true}
  tagPosition="bottom"
  cropButtonLabel="Crop Image"
  deleteConfirmText="Are you sure?"
  ...50 more props
/>
```

Good:
```svelte
<MediaSpotlight {items} bind:currentIndex onclose={handleClose}>
  <SpotlightTagBar slot="bottom" {tags} ontoggle={handleTag} />
  <SpotlightActions slot="actions">
    <CropButton onclick={openCrop} />
    <DeleteButton onclick={confirmDelete} />
  </SpotlightActions>
</MediaSpotlight>
```

Slots and composition beat prop explosion. The component does one thing well; consumers compose features.

### 4. Accessibility as Foundation, Not Afterthought

Every component ships with:
- Proper ARIA roles and labels
- Keyboard navigation (documented)
- Focus trapping where appropriate
- `prefers-reduced-motion` support
- Touch targets ≥48px (WCAG AAA)

### 5. TypeScript Strict Mode, Always

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

No `any`. No `// @ts-ignore`. Types are documentation that never goes stale.

### 6. Docs Live With Code

Each package has:
```
packages/media-spotlight/
├── src/
├── docs/
│   ├── README.md           # Usage, API, examples
│   ├── CHANGELOG.md        # Version history
│   └── examples/           # Working code examples
├── package.json
└── tsconfig.json
```

### 7. Semver Religiously

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes to public API
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes only

NEVER break consuming apps on minor/patch updates.

---

## Distribution Strategy

### Option A: Git Dependencies (Current - No Cost)

```json
{
  "dependencies": {
    "@austencloud/media-spotlight": "github:austencloud/shared-packages#media-spotlight-v1.2.0"
  }
}
```

**Pros:** Free, simple, works now
**Cons:** Slower installs, harder to browse versions

### Option B: GitHub Package Registry (Free for Public)

```json
{
  "dependencies": {
    "@austencloud/media-spotlight": "^1.2.0"
  }
}
```

Requires `.npmrc`:
```
@austencloud:registry=https://npm.pkg.github.com
```

**Pros:** Proper npm-style versioning, faster installs
**Cons:** Slight setup complexity

### Option C: npm Public Registry (Free)

Same as B but packages are fully public on npmjs.com.

**Pros:** Standard, discoverable, could build community
**Cons:** Code is public (may not want this for all packages)

### Recommendation: Start with A, Graduate to B

Use git dependencies during active development (instant updates via `npm update`). Move to GitHub Packages when a package stabilizes and you want proper versioning.

---

## Repository Structure

### Single Repo (Monorepo) vs Multiple Repos

**Monorepo (Recommended):**
```
austencloud-packages/
├── packages/
│   ├── media-spotlight/
│   ├── drawer/
│   ├── theme/
│   └── backgrounds/
├── package.json          # Workspace root
├── pnpm-workspace.yaml
└── turbo.json            # Optional: Turborepo for build caching
```

**Why monorepo:**
- Single PR can update multiple packages
- Shared tooling (ESLint, Prettier, TypeScript)
- Atomic commits across package boundaries
- Easier local development (pnpm workspace links)

**Multiple repos only if:**
- Different teams own different packages
- Vastly different release cadences
- Legal/licensing reasons

---

## Immediate Action Plan

### Phase 1: Consolidate Existing (This Week)

1. **Merge existing packages into monorepo structure**
   - Move `austencloud-theme` → `packages/theme`
   - Move `austencloud-backgrounds` → `packages/backgrounds`
   - Set up pnpm workspaces

2. **Establish tooling**
   - Shared ESLint config
   - Shared TypeScript config
   - Shared Prettier config
   - Changesets for version management

### Phase 2: Extract Media Spotlight (This Week)

3. **Create `packages/media-spotlight`**
   - Port gesture engine from TKA Scribe
   - Port MediaSpotlight components
   - Merge in Cirque Aflame curation features
   - Document API

4. **Wire into both apps**
   - TKA Scribe: Replace feedback screenshot viewer
   - Cirque Aflame: Replace MediaCuratorOverlay

### Phase 3: Extract More Primitives (Next Month)

5. **Drawer component**
   - TKA's Drawer.svelte is more battle-tested
   - Cirque's Sheet.svelte has some good ideas
   - Merge best of both

6. **Modal component**
   - Native `<dialog>` with `@starting-style`
   - Focus trapping
   - Backdrop click handling

### Phase 4: Navigation System (Future)

7. **Sidebar navigation**
   - This is complex and app-specific
   - Start by extracting primitives (collapse animation, nav item)
   - Full system extraction only after more apps use similar patterns

---

## Package: @austencloud/media-spotlight

### Features (Merged from Both Apps)

**From TKA Scribe (Viewing Focus):**
- Native `<dialog>` with CSS-only animations
- Horizontal swipe navigation
- Vertical swipe-to-dismiss
- Pinch-to-zoom, double-tap zoom
- Auto-hiding chrome
- Thumbnail filmstrip
- Image preloading
- Keyboard shortcuts (←/→/Esc)

**From Cirque Aflame (Curation Focus):**
- Tag management with number key shortcuts
- Crop editor integration
- Video trim/snip editor integration
- "Needs editing" flag
- Delete with confirmation
- Progress indicator (3/47)
- Keyboard hints bar

### API Design

```svelte
<MediaSpotlight
  {items}
  bind:currentIndex
  bind:open
  onclose={() => {}}
  ondelete={(item) => {}}
  ontag={(item, tagId) => {}}
  onchange={(item, changes) => {}}
>
  <!-- Optional: Custom tag bar -->
  <SpotlightTagBar slot="tags" {availableTags} />

  <!-- Optional: Custom actions -->
  <svelte:fragment slot="actions">
    <SpotlightCropButton />
    <SpotlightDeleteButton />
  </svelte:fragment>

  <!-- Optional: Custom keyboard hints -->
  <SpotlightKeyboardHints slot="hints" {hints} />
</MediaSpotlight>
```

### File Structure

```
packages/media-spotlight/
├── src/
│   ├── MediaSpotlight.svelte       # Main orchestrator
│   ├── SpotlightImage.svelte       # Image display
│   ├── SpotlightVideo.svelte       # Video display
│   ├── SpotlightChrome.svelte      # Auto-hiding UI
│   ├── SpotlightFilmstrip.svelte   # Thumbnail strip
│   ├── SpotlightTagBar.svelte      # Tag management
│   ├── SpotlightActions.svelte     # Action buttons container
│   ├── SpotlightKeyboardHints.svelte
│   ├── gestures/
│   │   ├── gesture-controller.ts   # Touch/pointer handling
│   │   └── spring-physics.ts       # Animation physics
│   ├── types.ts                    # Public types
│   └── index.ts                    # Public exports
├── css/
│   └── spotlight-tokens.css        # CSS custom properties
├── docs/
│   ├── README.md
│   └── CHANGELOG.md
├── package.json
└── tsconfig.json
```

---

## Success Metrics

**6 months:**
- 5+ packages extracted and in use
- Both TKA Scribe and Cirque Aflame consuming shared packages
- Zero duplicated UI code between apps

**1 year:**
- 10+ packages
- New app can be bootstrapped with shared packages in <1 hour
- Comprehensive documentation

**5 years:**
- Packages stable enough for public release
- Community contributions
- Used by other developers

---

## Anti-Patterns to Avoid

1. **Over-extraction** - Don't extract something until it's used in 2+ places
2. **Premature abstraction** - Let patterns emerge before codifying them
3. **Config explosion** - Composition beats 50 boolean props
4. **Breaking changes** - Semver violations destroy trust
5. **Undocumented APIs** - If it's not documented, it doesn't exist
6. **Testing theater** - Tests should catch real bugs, not check box

---

## Claude Skills Package

### Purpose

Shared Claude Code skill templates (slash commands like `/commit`, `/audit`, `/check`) that standardize workflows across all Austen Cloud projects.

### Location

`packages/claude-skills/`

### How Templates Work

Each skill is a markdown file in `templates/skills/<skill-name>/` with `{{variable}}` placeholders (e.g. `{{projectName}}`, `{{srcRoot}}`). Agent templates live in `templates/agents/<agent-name>/`. During sync, placeholders are replaced with values from the consuming project's config.

### How Consuming Projects Use It

1. Add a `.claude/skills.config.json` to the project root:
   ```json
   {
     "projectName": "My Project",
     "srcRoot": "src/lib",
     "skills": ["commit", "changelog", "check", "ai-bust", "monolith", "deadcode", "audit"]
   }
   ```
2. Run `npx @austencloud/claude-skills sync`
3. Synced files appear in `.claude/skills/` and `.claude/agents/` with a managed-by comment at the top.
4. Do NOT edit synced files directly. Edit the template and re-sync.

### Adding a New Skill Template

1. Create `templates/skills/<skill-name>/` with a markdown file.
2. Use `{{variable}}` syntax for any project-specific values.
3. Run sync in a consuming project to verify rendering.

### Adding a New Template Variable

1. Add the variable to `templates/` files using `{{variableName}}` syntax.
2. Consuming projects must add a matching key to their `skills.config.json`.
3. The sync command replaces all `{{variableName}}` occurrences with the config value.

### Skill-to-Agent Mapping

The **audit** skill maps to two agents:
- `audit-evaluator` — evaluates code quality against audit criteria
- `audit-fixer` — applies fixes for audit findings

Agent templates live in `templates/agents/` and are synced to `.claude/agents/` in consuming projects.

### Audit Tooling

The `ac-audit` and `ac-evidence` CLI commands in `@austencloud/code-quality` (separate package in this monorepo) provide the audit tracking and evidence collection consumed by the audit skill. These replace the old project-local scripts (`audit-tracker.cjs`, `collect-evidence.cjs`).

---

## Next Steps

1. Restructure `F:\_CODE\shared-packages` into proper monorepo
2. Set up pnpm workspaces
3. Create `@austencloud/media-spotlight` package
4. Wire into TKA Scribe and Cirque Aflame
5. Document and tag v1.0.0
