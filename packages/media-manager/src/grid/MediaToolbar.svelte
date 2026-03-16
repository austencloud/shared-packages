<!--
	MediaToolbar.svelte — Top toolbar with search, grid size, counts, filter mode, selection controls.
-->
<script lang="ts">
	interface Props {
		searchQuery: string;
		gridSize: number;
		totalCount: number;
		selectedCount: number;
		filterMode: 'and' | 'or';
		onsearchchange: (query: string) => void;
		ongridsizechange: (size: number) => void;
		onfiltermodechange: (mode: 'and' | 'or') => void;
		onselectall: () => void;
		ondeselectall: () => void;
	}

	const {
		searchQuery,
		gridSize,
		totalCount,
		selectedCount,
		filterMode,
		onsearchchange,
		ongridsizechange,
		onfiltermodechange,
		onselectall,
		ondeselectall
	}: Props = $props();

	let searchTimer: ReturnType<typeof setTimeout>;

	function handleSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			onsearchchange(value);
		}, 200);
	}

	function clearSearch() {
		onsearchchange('');
	}
</script>

<header class="toolbar">
	<!-- Search -->
	<div class="search-container">
		<svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l4.26 4.26a.75.75 0 11-1.06 1.06l-4.26-4.26A7 7 0 012 9z" clip-rule="evenodd" />
		</svg>
		<input
			type="search"
			class="search-input"
			placeholder="Search media..."
			value={searchQuery}
			oninput={handleSearchInput}
		/>
		{#if searchQuery}
			<button class="clear-btn" onclick={clearSearch} aria-label="Clear search">
				<svg class="clear-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M2 2l8 8M10 2l-8 8" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Grid size slider -->
	<div class="grid-control">
		<svg class="grid-icon" viewBox="0 0 20 20" fill="currentColor">
			<path fill-rule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clip-rule="evenodd" />
		</svg>
		<input
			type="range"
			min="2"
			max="8"
			value={gridSize}
			class="grid-slider"
			oninput={(e) => ongridsizechange(parseInt((e.target as HTMLInputElement).value))}
			aria-label="Grid columns"
		/>
		<span class="grid-count">{gridSize}</span>
	</div>

	<!-- Item count -->
	<span class="item-count" aria-live="polite">
		{totalCount} item{totalCount !== 1 ? 's' : ''}
	</span>

	<!-- Selected count -->
	{#if selectedCount > 0}
		<span class="selected-badge">
			{selectedCount} selected
		</span>
	{/if}

	<!-- Filter mode toggle -->
	<div class="filter-toggle">
		<button
			class="filter-btn"
			class:active={filterMode === 'and'}
			onclick={() => onfiltermodechange('and')}
		>
			AND
		</button>
		<button
			class="filter-btn"
			class:active={filterMode === 'or'}
			onclick={() => onfiltermodechange('or')}
		>
			OR
		</button>
	</div>

	<!-- Select / Deselect all -->
	<div class="select-controls">
		<button class="select-btn" onclick={onselectall}>Select All</button>
		{#if selectedCount > 0}
			<button class="select-btn" onclick={ondeselectall}>Deselect All</button>
		{/if}
	</div>
</header>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		border-bottom: 1px solid var(--mm-border, #333355);
		background: var(--mm-surface-raised, #222240);
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 0 12px;
		height: 36px;
		background: var(--mm-surface, #1a1a2e);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 6px;
		transition: border-color 0.15s;
	}

	.search-container:focus-within {
		border-color: var(--mm-accent, #6366f1);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 20%, transparent);
	}

	.search-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--mm-text-muted, #9999b0);
	}

	.search-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--mm-text, #e8e8f0);
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--mm-text-dim, #66668a);
	}

	.clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--mm-surface-overlay, #2a2a4a);
		border: none;
		color: var(--mm-text-muted, #9999b0);
		cursor: pointer;
		flex-shrink: 0;
	}

	.clear-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
		color: var(--mm-text, #e8e8f0);
	}

	.clear-icon {
		width: 12px;
		height: 12px;
	}

	.grid-control {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.grid-icon {
		width: 16px;
		height: 16px;
		color: var(--mm-text-muted, #9999b0);
	}

	.grid-slider {
		width: 80px;
		height: 6px;
		cursor: pointer;
		appearance: none;
		border-radius: 9999px;
		background: var(--mm-border, #333355);
		accent-color: var(--mm-accent, #6366f1);
	}

	.grid-count {
		width: 16px;
		text-align: center;
		font-size: 12px;
		color: var(--mm-text-dim, #66668a);
	}

	.item-count {
		font-size: 12px;
		color: var(--mm-text-dim, #66668a);
		white-space: nowrap;
	}

	.selected-badge {
		padding: 2px 8px;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 20%, transparent);
		font-size: 12px;
		font-weight: 600;
		color: var(--mm-accent, #6366f1);
		white-space: nowrap;
	}

	.filter-toggle {
		display: flex;
		overflow: hidden;
		border-radius: 6px;
		border: 1px solid var(--mm-border, #333355);
		font-size: 12px;
	}

	.filter-btn {
		padding: 4px 10px;
		border: none;
		background: var(--mm-surface, #1a1a2e);
		color: var(--mm-text-muted, #9999b0);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.filter-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.filter-btn.active {
		background: var(--mm-accent, #6366f1);
		color: white;
	}

	.select-controls {
		display: flex;
		gap: 4px;
	}

	.select-btn {
		padding: 4px 10px;
		border: 1px solid var(--mm-border, #333355);
		border-radius: 6px;
		background: transparent;
		color: var(--mm-text-muted, #9999b0);
		font-size: 12px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.select-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
		color: var(--mm-text, #e8e8f0);
	}
</style>
