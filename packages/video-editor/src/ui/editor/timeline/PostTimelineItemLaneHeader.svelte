<script lang="ts">
	import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
	import Icon from "../../kit/Icon.svelte";

	/**
	 * The header for one item lane: its name behind the plugin's icon. Pressing
	 * it selects the lane, the same as pressing its bar.
	 */
	interface Props {
		label: string;
		icon: IconDefinition;
		heightPx: number;
		selected: boolean;
		onSelect: () => void;
	}

	let { label, icon, heightPx, selected, onSelect }: Props = $props();
</script>

<div class="item-lane-header" class:selected style="height: {heightPx}px">
	<button type="button" class="lane-name" aria-pressed={selected} aria-label={label} onclick={onSelect}>
		<Icon {icon} />
		<span class="lane-text">{label}</span>
	</button>
</div>

<style>
	.item-lane-header {
		--lane-header-bg: color-mix(in srgb, var(--ve-theme-bg, #101018) 70%, #000);
		display: flex;
		box-sizing: border-box;
		align-items: center;
		padding: 0 0.5rem 0 0.4375rem;
		border-bottom: 1px solid var(--ve-theme-stroke, rgba(255, 255, 255, 0.06));
		background: var(--lane-header-bg);
	}

	/* The selected lane's header takes the same tint as its span in the lane
		 beside it, so the whole row reads as the lane in hand. */
	.item-lane-header.selected {
		background: color-mix(
			in srgb,
			var(--ve-theme-accent) 12%,
			var(--lane-header-bg)
		);
	}

	.lane-name {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		min-height: var(--ve-min-touch-target, 44px);
		padding: 0 0.35rem;
		border: 0;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--ve-theme-text-dim);
		cursor: pointer;
		font: inherit;
		text-align: left;
	}

	.item-lane-header.selected .lane-name {
		color: var(--ve-theme-text, #fff);
	}

	.lane-name :global(svg) {
		flex-shrink: 0;
		width: 1rem;
		font-size: 0.75rem;
		text-align: center;
	}

	.item-lane-header.selected .lane-name :global(svg) {
		color: var(--ve-theme-accent);
	}

	.lane-text {
		min-width: 0;
		overflow: hidden;
		font-size: var(--ve-font-size-compact, 0.75rem);
		font-weight: 600;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (hover: hover) {
		.lane-name:hover {
			background: var(--ve-theme-card-hover-bg, rgba(255, 255, 255, 0.08));
			color: var(--ve-theme-text);
		}
	}

	.lane-name:focus-visible {
		outline: 2px solid var(--ve-theme-accent);
		outline-offset: -2px;
	}

	/* The narrow header keeps the icon, as track rows keep their toggles. */
	@container post-timeline-header (max-width: 7rem) {
		.lane-text {
			display: none;
		}
	}
</style>
