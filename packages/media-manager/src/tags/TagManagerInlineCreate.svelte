<script lang="ts">
	import TagManagerColorPicker from './TagManagerColorPicker.svelte';
	import TagManagerCategoryPicker from './TagManagerCategoryPicker.svelte';
	import type { TagColor } from '../types.js';

	interface Props {
		oncreate: (name: string, color: TagColor, category: string) => void;
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string> | undefined;
		/** Default category for new tags. */
		defaultCategory?: string | undefined;
	}

	const { oncreate, categories, categoryLabels, defaultCategory }: Props = $props();

	let name = $state('');
	let color = $state<TagColor>('royal');
	let category = $state(defaultCategory ?? categories[0] ?? 'custom');
	let creating = $state(false);
	let nameInputEl: HTMLInputElement | undefined = $state();

	function handleCreate() {
		const trimmed = name.trim();
		if (!trimmed || creating) return;
		creating = true;
		oncreate(trimmed, color, category);
		name = '';
		creating = false;
		nameInputEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleCreate();
		}
	}

	$effect(() => {
		if (nameInputEl) {
			nameInputEl.focus();
		}
	});
</script>

<div class="inline-create">
	<div class="create-row">
		<input
			bind:this={nameInputEl}
			type="text"
			class="name-input"
			placeholder="Tag name..."
			bind:value={name}
			onkeydown={handleKeydown}
			aria-label="New tag name"
		/>
		<button
			class="create-btn"
			onclick={handleCreate}
			disabled={!name.trim() || creating}
		>
			{creating ? 'Creating...' : 'Create'}
		</button>
	</div>

	<div class="picker-section">
		<span class="picker-label">Color</span>
		<TagManagerColorPicker selected={color} onselect={(c) => (color = c)} />
	</div>

	<div class="picker-section">
		<span class="picker-label">Category</span>
		<TagManagerCategoryPicker
			selected={category}
			onselect={(c) => (category = c)}
			{categories}
			{categoryLabels}
		/>
	</div>
</div>

<style>
	.inline-create {
		padding: 12px 16px;
		background: var(--mm-surface-raised, #222240);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.create-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.name-input {
		flex: 1;
		padding: 8px 12px;
		background: var(--mm-surface, #1a1a2e);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 6px;
		color: var(--mm-text, #e8e8f0);
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}

	.name-input:focus {
		border-color: var(--mm-accent, #6366f1);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 25%, transparent);
	}

	.name-input::placeholder {
		color: var(--mm-text-dim, #66668a);
	}

	.create-btn {
		padding: 8px 20px;
		background: var(--mm-accent, #6366f1);
		border: none;
		border-radius: 6px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.create-btn:hover:not(:disabled) {
		background: var(--mm-accent-hover, #4f46e5);
	}

	.create-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.create-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.create-btn:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}

	.picker-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.picker-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--mm-text-muted, #9999b0);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
