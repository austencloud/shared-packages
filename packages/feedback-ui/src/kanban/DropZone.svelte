<script lang="ts">
	const {
		label,
		color,
		icon,
		onDrop,
	}: {
		label: string;
		color: string;
		icon: string;
		onDrop: (itemId: string) => void;
	} = $props();

	let isDragOver = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const itemId = e.dataTransfer?.getData('text/plain');
		if (itemId) onDrop(itemId);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="drop-zone"
	class:drag-over={isDragOver}
	style:--zone-color={color}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<span class="zone-icon" aria-hidden="true">{icon}</span>
	<span class="zone-label">{label}</span>
</div>

<style>
	.drop-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-md, 12px);
		border: 2px dashed color-mix(in srgb, var(--zone-color) 40%, transparent);
		background: color-mix(in srgb, var(--zone-color) 5%, transparent);
		color: color-mix(in srgb, var(--zone-color) 60%, var(--theme-text-dim, rgba(148, 163, 184, 0.9)));
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		transition: all var(--fb-duration-emphasis, 0.28s) var(--fb-spring, ease);
		min-height: 60px;
	}

	.drop-zone.drag-over {
		border-color: var(--zone-color);
		border-style: solid;
		background: color-mix(in srgb, var(--zone-color) 12%, transparent);
		color: var(--zone-color);
		transform: scale(1.03);
		backdrop-filter: blur(var(--fb-overlay-blur, 8px));
		animation: drop-ready 1.5s ease-in-out infinite;
	}

	.zone-icon {
		font-size: 1.2rem;
	}

	@keyframes drop-ready {
		0%, 100% { box-shadow: 0 0 0 0 transparent; }
		50% { box-shadow: 0 0 16px color-mix(in srgb, var(--zone-color) 25%, transparent); }
	}

	@media (prefers-reduced-motion: reduce) {
		.drop-zone {
			transition: none;
		}
		.drop-zone.drag-over {
			animation: none;
		}
	}
</style>
