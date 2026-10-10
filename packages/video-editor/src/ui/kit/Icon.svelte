<script lang="ts">
	import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

	interface Props {
		icon: IconDefinition;
		/** Turns once a second, as Font Awesome's spin did. */
		spin?: boolean;
		/** Set for an icon that is the only content of a control; otherwise the icon is hidden from assistive tech. */
		label?: string;
		class?: string;
	}

	let { icon, spin = false, label, class: extra = "" }: Props = $props();
	const width = $derived(icon.icon[0]);
	const height = $derived(icon.icon[1]);
	const paths = $derived(Array.isArray(icon.icon[4]) ? icon.icon[4] : [icon.icon[4]]);
</script>

<svg
	class="ve-icon {extra}"
	class:spin
	viewBox="0 0 {width} {height}"
	role={label ? "img" : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : "true"}
	focusable="false"
>
	{#each paths as d (d)}
		<path fill="currentColor" {d} />
	{/each}
</svg>

<style>
	.ve-icon {
		display: inline-block;
		width: 1.25em;
		height: 1em;
		overflow: visible;
		vertical-align: -0.125em;
		flex-shrink: 0;
	}
	.spin {
		animation: ve-icon-spin 1s linear infinite;
	}
	@keyframes ve-icon-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
