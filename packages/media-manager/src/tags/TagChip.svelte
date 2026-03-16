<script lang="ts">
	import { getTagHex, type MediaTag } from '../types.js';

	interface Props {
		tag: MediaTag;
		removable?: boolean;
		onremove?: () => void;
	}

	const { tag, removable = false, onremove }: Props = $props();

	let hex = $derived(getTagHex(tag));
</script>

<span class="tag-chip" style="--chip-bg: {hex}20; --chip-border: {hex}40; --chip-text: {hex}">
	<span class="dot" style="background: {hex}"></span>
	<span class="label">{tag.name}</span>
	{#if removable && onremove}
		<button class="remove-btn" onclick={onremove} aria-label="Remove {tag.name}">
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
				<path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</button>
	{/if}
</span>

<style>
	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		background: var(--chip-bg);
		border: 1px solid var(--chip-border);
		border-radius: 9999px;
		font-size: 12px;
		font-weight: 500;
		color: var(--chip-text);
		white-space: nowrap;
		line-height: 1.4;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.label {
		color: var(--mm-text, #e8e8f0);
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		background: none;
		border: none;
		border-radius: 50%;
		color: var(--mm-text-muted, #9999b0);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;
	}

	.remove-btn:hover {
		background: var(--chip-border);
		color: var(--mm-text, #e8e8f0);
	}

	.remove-btn:active {
		transform: scale(0.85);
	}
</style>
