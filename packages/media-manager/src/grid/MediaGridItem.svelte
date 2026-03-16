<!--
	MediaGridItem.svelte — Single thumbnail card in the media grid.
	Shows thumbnail, tag chips, selection checkbox, review badge, and suggested name.
-->
<script lang="ts">
	import type { MediaItem, MediaTag } from '../types.js';
	import { getTagHex } from '../types.js';
	import ShimmerBlock from '../loading/ShimmerBlock.svelte';

	interface Props {
		item: MediaItem;
		selected: boolean;
		tags: MediaTag[];
		onselect: (selected: boolean) => void;
		onclick: (event: MouseEvent) => void;
	}

	const { item, selected, tags, onselect, onclick }: Props = $props();

	let imageLoaded = $state(false);
	let imageError = $state(false);

	const maxVisibleTags = 3;
	const visibleTags = $derived(tags.slice(0, maxVisibleTags));
	const extraTagCount = $derived(Math.max(0, tags.length - maxVisibleTags));
</script>

<button
	class="grid-item"
	class:selected
	onclick={onclick}
	title={item.filename}
>
	<!-- Shimmer placeholder while loading -->
	{#if !imageLoaded && !imageError}
		<div class="shimmer-container">
			<ShimmerBlock width="100%" height="100%" borderRadius="0" />
		</div>
	{/if}

	<!-- Thumbnail image -->
	<img
		src={item.thumbnailUrl}
		alt={item.suggestedName || item.filename}
		class="thumbnail"
		class:loaded={imageLoaded}
		loading="lazy"
		decoding="async"
		onload={() => { imageLoaded = true; }}
		onerror={() => { imageError = true; }}
	/>

	<!-- Error state -->
	{#if imageError}
		<div class="error-state">No image</div>
	{/if}

	<!-- Selection checkbox (top-left) -->
	<div
		class="checkbox"
		class:selected
		role="checkbox"
		tabindex={0}
		aria-checked={selected}
		onclick={(e) => { e.stopPropagation(); onselect(!selected); }}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onselect(!selected); } }}
	>
		{#if selected}
			<svg class="check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5">
				<path d="M2 6l3 3 5-5" />
			</svg>
		{/if}
	</div>

	<!-- Needs Review badge (top-right) -->
	{#if item.needsReview}
		<span class="review-badge">Review</span>
	{/if}

	<!-- Tag chips (bottom-left) -->
	{#if tags.length > 0}
		<div class="tag-dots">
			{#each visibleTags as tag (tag.id)}
				<span
					class="tag-dot"
					style="background: {getTagHex(tag)}"
					title={tag.name}
				></span>
			{/each}
			{#if extraTagCount > 0}
				<span class="tag-extra">+{extraTagCount}</span>
			{/if}
		</div>
	{/if}

	<!-- Suggested name (bottom overlay, shown on hover) -->
	{#if item.suggestedName}
		<div class="name-overlay">
			<span class="name-text">{item.suggestedName}</span>
		</div>
	{/if}
</button>

<style>
	.grid-item {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--mm-grid-item-radius, 8px);
		border: 2px solid transparent;
		background: var(--mm-surface-raised, #222240);
		padding: 0;
		cursor: pointer;
		transition: all 0.15s;
	}

	.grid-item:hover {
		border-color: color-mix(in srgb, var(--mm-accent, #6366f1) 50%, transparent);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.grid-item:active {
		transform: scale(0.97);
	}

	.grid-item.selected {
		border-color: var(--mm-accent, #6366f1);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 30%, transparent);
	}

	.shimmer-container {
		position: absolute;
		inset: 0;
	}

	.thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.3s;
	}

	.thumbnail.loaded {
		opacity: 1;
	}

	.error-state {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--mm-surface-raised, #222240);
		color: var(--mm-text-dim, #66668a);
		font-size: 12px;
	}

	.checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: 2px solid color-mix(in srgb, var(--mm-text-muted, #9999b0) 60%, transparent);
		background: color-mix(in srgb, var(--mm-surface, #1a1a2e) 60%, transparent);
		color: transparent;
		backdrop-filter: blur(4px);
		transition: all 0.15s;
	}

	.checkbox.selected {
		border-color: var(--mm-accent, #6366f1);
		background: var(--mm-accent, #6366f1);
		color: white;
	}

	.check-icon {
		width: 12px;
		height: 12px;
	}

	.review-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 6px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--mm-warning, #f59e0b) 90%, transparent);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mm-surface, #1a1a2e);
	}

	.tag-dots {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.tag-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.tag-extra {
		padding: 0 4px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--mm-surface, #1a1a2e) 70%, transparent);
		font-size: 10px;
		color: var(--mm-text, #e8e8f0);
		backdrop-filter: blur(4px);
	}

	.name-overlay {
		position: absolute;
		inset: auto 0 0 0;
		padding: 16px 8px 6px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
		opacity: 0;
		transform: translateY(100%);
		transition: all 0.15s;
	}

	.grid-item:hover .name-overlay {
		opacity: 1;
		transform: translateY(0);
	}

	.name-text {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		color: var(--mm-text, #e8e8f0);
	}
</style>
