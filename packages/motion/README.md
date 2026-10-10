# @austencloud/motion

One motion clock for AustenCloud apps. It holds the duration tokens, Svelte transitions that honor reduced motion, a `Crossfade` component, `followHeight`, page changes built on the View Transitions API with record morphs (a clicked box grows into its page), and a scanner that fails a test when an app writes raw motion outside these owners. Ringmaster, the Cirque Aflame website and the Flow Arts Composer share it so every layout change moves on the same clock.

## Install

```bash
npm install @austencloud/motion
```

Svelte 5 is a peer dependency. SvelteKit is not required; the page-change helper takes SvelteKit's `onNavigate` as an argument, so the package never imports `$app/*`.

## Owners

Decide first. Movement that means nothing (a summary changing length, a count updating) gets reserved space so nothing moves. Movement that means something (a row arriving, a panel swapping, a record opening) is animated by one of these owners.

| Change | Owner |
| --- | --- |
| Two states swap in one box | `Crossfade` (`fill` for sized parents, `animateHeight` when heights differ a lot) |
| One element enters or leaves flow | `growFade` |
| A badge or control in reserved space | `flyFade`, `popIn` |
| Keyed list filters, sorts or reflows | `animate:flip={{ duration: flipDuration() }}` with `in:arrive={{ index }}` and `out:leave`; the list gets `position: relative` |
| A box follows its content's height | `followHeight` |
| A list-detail panel swap | an app-level layout built on `Crossfade` |
| Opening a record page | the route morph: the source box has `data-record="kind:id"`, the page header has `data-record-target="kind:id"`, the photo has `data-record-photo`, and a page still loading calls `holdPageReady()` |

## Clock

Durations come from `DURATION` (instant 100, fast 150, normal 200, emphasis 280, dramatic 350, scene 800) or the matching CSS tokens (`--duration-fast`, `--duration-normal`, `--duration-emphasis`, `--duration-dramatic`) with `--ease-standard`. Feature code never writes raw milliseconds, raw `cubic-bezier` values or `transition: all`.

```ts
import { DURATION, STAGGER, flyFade, growFade, popIn, Crossfade, followHeight } from '@austencloud/motion';
```

## Page changes

Call `installRouteMotion` once from the root layout's script, during component init. SvelteKit's `onNavigate` requires that.

```svelte
<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { installRouteMotion } from '@austencloud/motion';

	// Route ids of pages that show one record, and the params naming it.
	const RECORD_ROUTES = {
		'/performers/[id]': { kind: 'performer', params: ['id'] },
		'/services/[category]/[service]': { kind: 'service', params: ['category', 'service'] }
	};

	installRouteMotion({ routes: RECORD_ROUTES, onNavigate });
</script>
```

Mark up the page with these attributes:

- `data-route-content` on the page area that fades between pages.
- `data-route-hold="header"` or `data-route-hold="nav"` on chrome that overlaps the page area (a fixed header, a phone bottom bar), so it keeps its own layer above the page.
- `data-record="kind:id"` on the box that opens a record. Several route params are joined with `/`, so the service page above is `service:fire/fire-show`.
- `data-record-target="kind:id"` on the header of the page that shows that record.
- `data-record-photo` on a photo that should travel with the box.
- `holdPageReady()` in a page that is still loading when navigation ends. It returns a release function; call it once the header exists.

A query-only change on the same page is that page's own motion and gets none here. Reduced motion and browsers without view transitions get the plain swap.

## CSS

```css
@import '@austencloud/motion/css/tokens.css';
@import '@austencloud/motion/css/route-transitions.css';
```

or, from a layout script, `import '@austencloud/motion/css/tokens.css'` and `import '@austencloud/motion/css/route-transitions.css'`. `tokens.css` defines the `--duration-*`, `--ease-standard*` and `--stagger-*` custom properties. `route-transitions.css` holds the `::view-transition-*` rules and keyframes keyed on the attributes above. The token values are tested against `DURATION` and `STAGGER`.

## Coverage scanner

Node-only, so it lives on its own subpath. Each app runs it over its `src/` in a test and lists its own exemptions.

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { scanTree } from '@austencloud/motion/coverage';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOT_YET = new Set<string>(); // files still waiting for an owner
const skip = (file: string) => NOT_YET.has(file) || file.startsWith('lib/motion/');

it('has no raw motion anywhere in the app', () => {
	const findings = scanTree(SRC, skip);
	expect(findings.map((f) => `${f.file}: ${f.rule}: ${f.text}`)).toEqual([]);
});
```

It flags `svelte/transition` imports, `transition: all`, raw millisecond durations in CSS, directives and `motionDuration(...)`, and raw `cubic-bezier` values.

## Always

- Honor reduced motion. The owners already do; a hand-written transition goes through `motionDuration`.
- A second change mid-animation continues from what is on screen.
- Keep keyboard focus, scroll position and immediate interaction during transitions.
- A structural motion change is not done until its frames have been watched in a real browser.
