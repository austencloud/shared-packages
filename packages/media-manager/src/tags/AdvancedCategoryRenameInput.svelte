<!--
	CategoryRenameInput.svelte: Inline-edit component for category headings.
	Shows label as text, double-click or pencil icon activates input field.
	Enter to save, Escape to cancel.
-->
<script lang="ts">
	import Icon from './AdvancedTagIcon.svelte';

	interface Props {
		label: string;
		categoryKey: string;
		headingLevel?: 'h3' | 'h4';
		onRename: (categoryKey: string, newLabel: string) => void;
	}

	const { label, categoryKey, headingLevel = 'h3', onRename }: Props = $props();

	let editing = $state(false);
	let editValue = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	function startEditing() {
		editValue = label;
		editing = true;
		// Input will be auto-focused via $effect
	}

	function saveEdit() {
		// A blur that fires after Escape has already closed the editor (the
		// input is removed and briefly retains focus while it unmounts)
		// must not save the name it was mid-typing.
		if (!editing) return;
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== label) {
			onRename(categoryKey, trimmed);
		}
		editing = false;
	}

	function cancelEdit() {
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			// Without this, TagManager's own Escape handler (an ancestor
			// listener) sees the same bubbling keydown and closes the whole
			// panel instead of just this rename.
			e.stopPropagation();
			cancelEdit();
		}
	}

	$effect(() => {
		if (editing && inputEl) {
			inputEl.focus();
			inputEl.select();
		}
	});
</script>

{#if editing}
	<div class="rename-container">
		<input
			bind:this={inputEl}
			type="text"
			class="rename-input"
			bind:value={editValue}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			aria-label="Category name"
		/>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="label-container" ondblclick={startEditing}>
		{#if headingLevel === 'h4'}
			<h4 class="category-heading">{label}</h4>
		{:else}
			<h3 class="category-heading">{label}</h3>
		{/if}
		<button
			class="rename-btn"
			onclick={startEditing}
			aria-label="Rename {label} category"
		>
			<Icon name="pen" size={12} />
		</button>
	</div>
{/if}

<style>
	.label-container {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--min-touch-target);
	}

	.category-heading {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.rename-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		min-height: 32px;
		padding: 4px;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-faint);
		cursor: pointer;
		transition: all 0.1s ease;
		opacity: 0;
	}

	.rename-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.label-container:hover .rename-btn {
		opacity: 1;
	}

	/* Touch screens have no hover, so the pencil never showed and category
	   rename was only reachable by double-tap, which nothing hinted at */
	@media (hover: none) {
		.rename-btn {
			opacity: 1;
		}
	}

	.rename-btn:hover {
		background: var(--interactive-active);
		color: var(--text-muted);
	}

	.rename-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		opacity: 1;
	}

	.rename-container {
		display: flex;
		align-items: center;
		min-height: var(--min-touch-target);
	}

	.rename-input {
		padding: 6px 10px;
		min-height: 36px;
		background: var(--interactive-active);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-sm);
		color: var(--theme-text);
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		outline: none;
		width: 100%;
		max-width: 200px;
	}

	.rename-input:focus {
		border-color: var(--cirque-royal);
		box-shadow: 0 0 0 2px var(--royal-bg-strong);
	}
</style>
