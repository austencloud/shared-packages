<script lang="ts">
	import { tick, type Snippet } from "svelte";
	import { useEditorServices } from "../editor-context.js";

	interface Props {
		open: boolean;
		anchor: HTMLElement | null;
		/** Accessible name of the panel. */
		label: string;
		placement?: "top" | "bottom";
		/** Gap to the anchor, in pixels. */
		offset?: number;
		/** The anchor edge the panel lines up with; the zoom control's bits-ui panel used "start". */
		align?: "start" | "center";
		onclose?: () => void;
		children: Snippet;
	}

	let {
		open = $bindable(),
		anchor,
		label,
		placement = "top",
		offset = 8,
		align = "center",
		onclose,
		children,
	}: Props = $props();

	const services = useEditorServices();
	const id = `ve-popover-${Math.random().toString(36).slice(2)}`;
	let panel = $state<HTMLDivElement | null>(null);
	let left = $state(0);
	let top = $state(0);

	/** The panel lives on the body, as bits-ui's did, so no transformed ancestor offsets it. */
	function portal(node: HTMLElement) {
		document.body.append(node);
		return { destroy: () => node.remove() };
	}

	function place(): void {
		if (!anchor || !panel) return;
		const a = anchor.getBoundingClientRect();
		const p = panel.getBoundingClientRect();
		const wanted = align === "start" ? a.left : a.left + a.width / 2 - p.width / 2;
		left = Math.min(Math.max(8, wanted), window.innerWidth - p.width - 8);
		top = placement === "top" ? a.top - p.height - offset : a.bottom + offset;
	}

	function close(): void {
		open = false;
		onclose?.();
		anchor?.focus();
	}

	$effect(() => {
		if (!open) return;
		void tick().then(() => {
			place();
			panel
				?.querySelector<HTMLElement>(
					"button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
				)
				?.focus();
		});
		const outside = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (target && (panel?.contains(target) || anchor?.contains(target))) return;
			close();
		};
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		document.addEventListener("pointerdown", outside, true);
		const offEscape = services.shortcuts.escapeLayer(id, close);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
			document.removeEventListener("pointerdown", outside, true);
			offEscape();
		};
	});
</script>

{#if open}
	<div
		use:portal
		bind:this={panel}
		class="ve-popover ve-portal"
		role="dialog"
		aria-label={label}
		style:left="{left}px"
		style:top="{top}px"
	>
		{@render children()}
	</div>
{/if}

<style>
	.ve-popover {
		position: fixed;
		z-index: var(--ve-z-dropdown, 300);
	}
</style>
