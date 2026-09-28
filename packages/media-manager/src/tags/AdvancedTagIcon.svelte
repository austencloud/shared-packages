<script lang="ts">
	import { getContext } from 'svelte';
	import { advancedTagContext, type AdvancedTagContext } from './advanced-tag-context.js';
	let { name, size = 14 }: { name: string; size?: number } = $props();
	const context = getContext<AdvancedTagContext>(advancedTagContext);
</script>

{#if context?.Icon}
	<context.Icon {name} {size} />
{:else}
	<span aria-hidden="true" style:font-size="{size}px">{name === 'check' ? '✓' : name === 'xmark' ? '×' : '•'}</span>
{/if}
