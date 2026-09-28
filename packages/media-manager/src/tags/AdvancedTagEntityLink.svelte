<script lang="ts">
	import { getContext } from 'svelte';
	import type { MediaTag } from '../types.js';
	import { advancedTagContext, type AdvancedTagContext } from './advanced-tag-context.js';
	import Icon from './AdvancedTagIcon.svelte';
	let { tag }: { tag: MediaTag } = $props();
	const context = getContext<AdvancedTagContext>(advancedTagContext);
	let href = $derived(context?.entityHref?.(tag));
</script>

{#if href}
	<a {href} aria-label={`Open ${tag.name} page`} title={`Open ${tag.name} page`}>
		<Icon name="arrow-up-right-from-square" size={12} />
	</a>
{/if}

<style>
	a { display: grid; place-items: center; flex: none; width: 32px; min-height: 36px; color: var(--text-muted); border-radius: 5px; }
	a:hover { color: var(--theme-text); background: var(--theme-hover-bg); }
	a:focus-visible { outline: 2px solid var(--royal-border); outline-offset: -2px; }
	@media (pointer: coarse) { a { width: 44px; min-height: 44px; } }
</style>
