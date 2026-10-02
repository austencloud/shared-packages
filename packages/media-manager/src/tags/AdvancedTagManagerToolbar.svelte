<script lang="ts">
	import Icon from './AdvancedTagIcon.svelte';

	type SortOption = 'name' | 'usage' | 'date';

	interface Props {
		searchQuery: string;
		sortBy: SortOption;
		categoryFilter: string | null;
		allCategories: string[];
		categoryLabels?: Record<string, string>;
		totalTagCount: number;
		visibleTagCount: number;
		selectedCount: number;
		allVisibleSelected: boolean;
		selectionMode: boolean;
		showBrowseSummary?: boolean;
		compact?: boolean;
		appearance?: 'default' | 'rows';
		onSearchChange: (query: string) => void;
		onSortChange: (sort: SortOption) => void;
		onCategoryFilterChange: (category: string | null) => void;
		onSelectAll: () => void;
		onToggleSelectionMode: () => void;
	}

	const {
		searchQuery,
		sortBy,
		categoryFilter,
		allCategories,
		totalTagCount,
		visibleTagCount,
		allVisibleSelected,
		selectionMode,
		showBrowseSummary = true,
		compact = false,
		appearance = 'default',
		onSearchChange,
		onSortChange,
		onSelectAll,
		onToggleSelectionMode
	}: Props = $props();

	// The category index has no visible tags to sort or select.
	let showControls = $derived(visibleTagCount > 0 && (!!categoryFilter || !!searchQuery.trim()));

	let searchInputEl: HTMLInputElement | undefined = $state();

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (searchQuery) {
				e.stopPropagation();
				onSearchChange('');
			}
		}
	}

	function clearSearch() {
		onSearchChange('');
		searchInputEl?.focus();
	}
</script>

<div class="toolbar" class:compact class:rows={appearance === 'rows'}>
	<div class="toolbar-top">
		<!-- Search -->
		<div class="search-container">
			<Icon name="magnifying-glass" size={14} />
			<input
				bind:this={searchInputEl}
				type="text"
				class="search-input"
				placeholder="Search tags..."
				value={searchQuery}
				oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
				onkeydown={handleSearchKeydown}
				aria-label="Search tags"
			/>
			{#if searchQuery}
				<button class="clear-btn" onclick={clearSearch} aria-label="Clear search">
					<Icon name="xmark" size={12} />
				</button>
			{/if}
		</div>
	</div>
	{#if showControls}
		<div class="list-controls">
			<label class="sort-label"
				>Sort <select
					aria-label="Sort tags"
					value={sortBy}
					onchange={(e) => onSortChange(e.currentTarget.value as SortOption)}
				>
					<option value="name">Name</option><option value="usage">Usage</option><option value="date"
						>Date</option
					>
				</select></label
			>
			<button
				class="selection-mode-btn"
				class:active={selectionMode}
				aria-pressed={selectionMode}
				onclick={onToggleSelectionMode}>{selectionMode ? 'Done selecting' : 'Select tags'}</button
			>
			{#if selectionMode}
				<button
					class="select-all-btn"
					class:active={allVisibleSelected && totalTagCount > 0}
					onclick={onSelectAll}
				>
					{allVisibleSelected && totalTagCount > 0 ? 'Deselect all' : 'Select all'}
				</button>
			{/if}
		</div>
	{/if}

	{#if searchQuery.trim()}
		<p class="search-summary" role="status">
			{visibleTagCount} result{visibleTagCount === 1 ? '' : 's'} across all categories
		</p>
	{:else if showBrowseSummary && categoryFilter}
		<p class="search-summary">
			{visibleTagCount} tag{visibleTagCount === 1 ? '' : 's'} in this category
		</p>
	{:else if showBrowseSummary}
		<p class="search-summary">
			{allCategories.length} categories · {totalTagCount} tags
		</p>
	{/if}
</div>

<style>
	.list-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sort-label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--theme-text-dim);
		font-size: 12px;
	}
	.sort-label select {
		min-height: 36px;
		padding: 0 24px 0 8px;
		color: var(--theme-text-dim);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		font: inherit;
	}
	.selection-mode-btn {
		min-height: 36px;
		padding: 0 10px;
		color: var(--theme-text-dim);
		background: transparent;
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}
	.selection-mode-btn.active {
		color: var(--royal-text);
		border-color: var(--royal-border);
		background: var(--royal-bg);
	}
	.sort-label select:focus-visible,
	.selection-mode-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.search-summary {
		margin: 0;
		font-size: 13px;
		color: var(--theme-text-dim);
	}
	.toolbar {
		padding: 10px 16px;
		border-bottom: 1px solid var(--theme-stroke);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.toolbar.compact {
		padding: 6px 10px;
		gap: 3px;
	}

	.toolbar.compact .search-container {
		min-height: var(--min-touch-target);
		border-radius: var(--radius-md);
	}

	.toolbar.compact .search-input {
		font-size: 14px;
	}

	.toolbar.compact .search-summary {
		font-size: 11px;
	}

	.toolbar-top {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Search */
	.search-container {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-lg);
		color: var(--text-faint);
		transition: border-color var(--duration-crisp) var(--ease-crisp);
		flex: 1;
		min-width: 0;
	}
	.toolbar.rows .search-container { background: transparent; border-color: var(--theme-stroke); border-radius: var(--radius-sm); }
	.toolbar.rows .search-container:focus-within { border-color: var(--theme-accent); box-shadow: none; }

	.search-container:focus-within {
		border-color: var(--royal-border);
		box-shadow: 0 0 0 2px var(--royal-bg);
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--theme-text);
		/* 16px keeps mobile browsers from zooming into the field */
		font-size: 16px;
		font-family: inherit;
		min-width: 0;
	}

	.search-input::placeholder {
		color: var(--text-faint);
	}

	.clear-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		background: var(--interactive-selected);
		border: none;
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
		flex-shrink: 0;
	}

	.clear-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.clear-btn:hover {
		background: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	/* Select all toggle */
	.select-all-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px 14px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-lg);
		color: var(--theme-text-dim);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	.select-all-btn:hover {
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	.select-all-btn:active {
		transform: scale(0.95);
	}

	.select-all-btn.active {
		background: var(--royal-bg-strong);
		border-color: var(--royal-border);
		color: var(--royal-text);
	}

	.select-all-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Phones: search gets its own full-width row. */
	@media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
		.toolbar {
			padding: 8px 12px;
		}

		.toolbar-top {
			flex-wrap: wrap;
		}

		.search-container {
			flex: 1 1 100%;
		}
	}

	/* On wider phones and tablets there is room for search next to the
	   sort and select controls */
	@media (min-width: 560px) and (max-width: 767px),
		(min-width: 560px) and (pointer: coarse) and (max-width: 900px) {
		.search-container {
			flex: 1 1 200px;
		}
	}

	/* The desktop media sidebar can be phone-width in a wide viewport. */
	@container (max-width: 600px) {
		.toolbar {
			padding: 8px 12px;
		}

		.toolbar-top {
			flex-wrap: wrap;
		}

		.search-container {
			flex: 1 1 100%;
		}
	}

	@container (max-width: 390px) {
		.select-all-btn {
			padding: 6px 8px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.search-container,
		.clear-btn,
		.select-all-btn,
		.selection-mode-btn,
		.sort-label select {
			transition: none;
		}
	}
</style>
