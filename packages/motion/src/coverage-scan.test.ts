import { describe, expect, it } from 'vitest';
import { scanSource } from './coverage-scan';

describe('motion coverage scan', () => {
	it('flags the patterns the clock replaces', () => {
		const svelte = `<script>import { fade } from 'svelte/transition';</script>
<div in:fade={{ duration: 200 }} animate:flip={{ duration: 180 }}></div>
<style>
	.a { transition: all 0.2s ease; }
	.b { transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1); }
	.c { animation: spin 1s linear infinite; }
	.d { transition: opacity var(--duration-fast) var(--ease-standard); }
	.e { --ease-x: cubic-bezier(0, 0, 1, 1); }
	.f { transition-duration: 0s !important; }
</style>`;
		const rules = scanSource(svelte, 'x.svelte').map((finding) => finding.rule);
		const script = `import type { TransitionConfig } from 'svelte/transition';
node.animate(frames, { duration: 140 });
const ms = motionDuration(180);
const ok = motionDuration(DURATION.fast);`;
		expect(scanSource(script, 'x.ts').map((finding) => finding.rule)).toEqual(['raw script duration', 'raw script duration']);
		expect(rules).toEqual([
			'svelte/transition import',
			'raw directive duration',
			'transition: all',
			'raw duration',
			'raw duration',
			'raw easing',
		]);
	});
});
