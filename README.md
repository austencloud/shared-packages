# @austencloud/packages

A pnpm monorepo of reusable packages that power Austen Cloud applications — Svelte 5 components, theming, animated backgrounds, media tools, and shared CLI utilities.

> Long-term vision in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Packages

### Published to npm

| Package | Description |
| --- | --- |
| [`@austencloud/theme`](./packages/theme) | Luminance-aware theming with CSS variables for Svelte 5 |
| [`@austencloud/backgrounds`](./packages/backgrounds) | Animated canvas backgrounds (snowfall, cherry blossom, sakura drift, ember…) |
| [`@austencloud/drawer`](./packages/drawer) | Bottom-sheet drawer with swipe gestures, snap points, and a11y |
| [`@austencloud/sidebar`](./packages/sidebar) | Composable collapsible sidebar navigation |
| [`@austencloud/media-spotlight`](./packages/media-spotlight) | Full-screen media viewer with gestures + curation |
| [`@austencloud/media-manager`](./packages/media-manager) | Tag manager, media grid, curator UI |
| [`@austencloud/chip-toggle`](./packages/chip-toggle) | Accessible chip-style toggle component |
| [`@austencloud/feedback-ui`](./packages/feedback-ui) | Svelte UI for the feedback queue + Kanban board |
| [`@austencloud/feedback-types`](./packages/feedback-types) | Shared TypeScript types for the feedback system |
| [`@austencloud/feedback-services`](./packages/feedback-services) | Feedback config + Cloud Functions client |
| [`@austencloud/image-loader`](./packages/image-loader) | Vanilla image loader with progressive enhancement |
| [`@austencloud/image-loader-svelte`](./packages/image-loader-svelte) | Svelte 5 wrapper for `image-loader` |
| [`@austencloud/code-quality`](./packages/code-quality) | `ac-audit` / `ac-evidence` CLI auditing tools |
| [`@austencloud/feedback-cli`](./packages/feedback-cli) | CLI for working with the feedback queue |

### Workspace-only (not published)

| Package | Notes |
| --- | --- |
| [`@austencloud/claude-skills`](./packages/claude-skills) | Templates synced into project `.claude/skills/` directories |
| [`@austencloud/dev-scripts`](./packages/dev-scripts) | Internal monorepo dev scripts |

---

## Repository layout

```
shared-packages/
├── .changeset/         Changeset configuration + pending changesets
├── .github/workflows/  CI + release automation
├── packages/           All workspace packages
├── ARCHITECTURE.md     Long-term vision + design principles
└── README.md           You are here
```

---

## Development

```bash
pnpm install            # install all workspace deps
pnpm build              # build every package that has a build script
pnpm dev                # watch-build all packages in parallel
pnpm check              # typecheck every package
pnpm check:publish      # publint every package (must pass before release)
pnpm check:types        # @arethetypeswrong/cli — verify types resolve for consumers
pnpm format             # prettier --write everywhere
pnpm lint               # eslint
```

---

## Releasing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning + publishing to npm. The flow is fully automated by [`.github/workflows/release.yml`](./.github/workflows/release.yml).

### Day-to-day

1. Make changes in one or more packages.
2. Run `pnpm changeset` and describe what changed (pick patch/minor/major per package).
3. Commit the generated `.changeset/*.md` along with your code.
4. Open a PR. CI (`.github/workflows/ci.yml`) runs `build` + `check` on every push.

### When merged to `main`

The release workflow takes over:

- If pending changesets exist, it opens (or updates) a **"Version Packages" PR** that bumps versions and updates each package's `CHANGELOG.md`.
- Merging that PR triggers the workflow again — this time it runs `pnpm release` (build → publint → `changeset publish`) and pushes the new versions to npm.

### Required GitHub secrets

- `NPM_TOKEN` — automation token from [npmjs.com/settings/<your-account>/tokens](https://www.npmjs.com/) with publish access to the `@austencloud` scope.
- `GITHUB_TOKEN` — provided automatically by Actions; the workflow grants `contents: write` and `pull-requests: write`.

---

## Adding a new package

1. Create `packages/<name>/` and copy the structure from [`packages/chip-toggle`](./packages/chip-toggle) (the cleanest reference).
2. Set the package name to `@austencloud/<name>`. If unpublished, add `"private": true`.
3. Make sure `package.json` has `exports`, `files`, `repository.directory`, and a `build` script.
4. `pnpm install` from the root, then `pnpm build` and `pnpm check:publish` to validate.

---

## Consuming downstream

Most projects depend on these packages from npm with normal semver:

```jsonc
{
  "dependencies": {
    "@austencloud/theme": "^0.1.0",
    "@austencloud/backgrounds": "^0.1.1"
  }
}
```

Unpublished packages (`media-manager` until first publish) can be referenced with a relative `file:` path:

```jsonc
"@austencloud/media-manager": "file:../shared-packages/packages/media-manager"
```

Switch to semver as soon as the package ships its first release.
