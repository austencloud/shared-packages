<script lang="ts">
	import type {
		FeedbackItem,
		FeedbackStatus,
		FeedbackType,
		FeedbackPriority,
	} from '@austencloud/feedback-types';
	import { STATUS_DISPLAY } from '@austencloud/feedback-types';
	import { groupByStatus, sortByPriority } from '@austencloud/feedback-services';
	import type { KanbanBoardProps, KanbanStatus } from './types.js';
	import KanbanColumn from './kanban/KanbanColumn.svelte';
	import FilterBar from './kanban/FilterBar.svelte';
	import DropZone from './kanban/DropZone.svelte';

	const {
		items,
		loading,
		onStatusChange,
		onArchive,
		onDefer,
		onItemClick,
		columns = ['new', 'in-progress', 'in-review', 'completed'],
		cardSnippet,
		showWipWarnings = true,
		showClaimIndicators = false,
		enableDragDrop = true,
		mobileBreakpoint = 652,
	}: KanbanBoardProps = $props();

	// ── Filter state ─────────────────────────────────────────
	let searchQuery = $state('');
	let typeFilter = $state<FeedbackType | null>(null);
	let priorityFilter = $state<FeedbackPriority | null>(null);

	// ── Mobile state ─────────────────────────────────────────
	let activeTab = $state<FeedbackStatus>(columns[0] as FeedbackStatus);
	let containerEl: HTMLElement | undefined = $state();
	let isMobile = $state(false);

	// ── Drag state ───────────────────────────────────────────
	let draggedItem = $state<FeedbackItem | null>(null);

	// ── Defer dialog ─────────────────────────────────────────
	let showDeferDialog = $state(false);
	let itemToDefer = $state<FeedbackItem | null>(null);
	let deferDate = $state('');
	let deferNotes = $state('');
	let isSubmittingDefer = $state(false);

	// ── Undo ─────────────────────────────────────────────────
	interface UndoAction {
		itemId: string;
		fromStatus: FeedbackStatus;
		toStatus: FeedbackStatus;
	}
	let undoStack = $state<UndoAction[]>([]);
	let showUndoHint = $state(false);

	// ── Filtered items ───────────────────────────────────────
	const filteredItems = $derived.by(() => {
		let result = items.filter((i) => !i.isDeleted);

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(i) =>
					i.title.toLowerCase().includes(q) ||
					i.description.toLowerCase().includes(q) ||
					i.userDisplayName.toLowerCase().includes(q)
			);
		}

		if (typeFilter) {
			result = result.filter((i) => i.type === typeFilter);
		}

		if (priorityFilter) {
			result = result.filter((i) => i.priority === priorityFilter);
		}

		return result;
	});

	const grouped = $derived(groupByStatus(filteredItems));

	// ── Container query via ResizeObserver ────────────────────
	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			isMobile = width < mobileBreakpoint;
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// ── Touch drop handler (called from KanbanCard) ──────────
	function handleTouchDrop(itemId: string, status: string) {
		handleDrop(itemId, status as FeedbackStatus);
	}

	// ── Drop handler ─────────────────────────────────────────
	async function handleDrop(itemId: string, toStatus: FeedbackStatus) {
		const item = items.find((i) => i.id === itemId);
		if (!item || item.status === toStatus) return;

		undoStack = [...undoStack.slice(-9), { itemId, fromStatus: item.status, toStatus }];
		if (!showUndoHint) {
			showUndoHint = true;
			setTimeout(() => (showUndoHint = false), 4000);
		}

		await onStatusChange(itemId, toStatus);
		draggedItem = null;
	}

	function handleDeferDrop(itemId: string) {
		const item = items.find((i) => i.id === itemId);
		if (!item) return;
		itemToDefer = item;
		showDeferDialog = true;
		draggedItem = null;
	}

	async function submitDefer() {
		if (!itemToDefer || !deferDate || !onDefer) return;
		isSubmittingDefer = true;
		try {
			await onDefer(itemToDefer.id, new Date(deferDate), deferNotes);
		} finally {
			isSubmittingDefer = false;
			showDeferDialog = false;
			itemToDefer = null;
			deferDate = '';
			deferNotes = '';
		}
	}

	function handleArchiveDrop(itemId: string) {
		onArchive?.(itemId, 'released');
		draggedItem = null;
	}

	// ── Undo ─────────────────────────────────────────────────
	async function undo() {
		const action = undoStack.at(-1);
		if (!action) return;
		undoStack = undoStack.slice(0, -1);
		await onStatusChange(action.itemId, action.fromStatus);
	}

	// ── Keyboard shortcuts ───────────────────────────────────
	function handleKeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		}
		if (e.key === 'Escape' && showDeferDialog) {
			showDeferDialog = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={containerEl}
	class="kanban-board"
	style:container-type="inline-size"
	style:container-name="kanban"
	onkeydown={handleKeydown}
>
	<FilterBar
		{searchQuery}
		{typeFilter}
		{priorityFilter}
		onSearchChange={(q) => (searchQuery = q)}
		onTypeFilterChange={(t) => (typeFilter = t)}
		onPriorityFilterChange={(p) => (priorityFilter = p)}
	/>

	{#if loading}
		<div class="loading-skeleton">
			<div class="skeleton-column"></div>
			<div class="skeleton-column"></div>
			<div class="skeleton-column"></div>
			<div class="skeleton-column"></div>
		</div>
	{:else if isMobile}
		<!-- Mobile: tab-based view -->
		<div class="mobile-tabs" role="tablist">
			{#each columns as col (col)}
				{@const config = STATUS_DISPLAY[col]}
				{@const count = grouped[col as KanbanStatus]?.length ?? 0}
				<button
					class="mobile-tab"
					class:active={activeTab === col}
					style:--tab-color={config.color}
					role="tab"
					aria-selected={activeTab === col}
					onclick={() => (activeTab = col as FeedbackStatus)}
				>
					{config.label}
					<span class="tab-count">{count}</span>
				</button>
			{/each}
		</div>

		<div class="mobile-column">
			<KanbanColumn
				status={activeTab}
				items={grouped[activeTab as KanbanStatus] ?? []}
				{showWipWarnings}
				{showClaimIndicators}
				enableDrag={enableDragDrop}
				{cardSnippet}
				onDragStart={(item) => (draggedItem = item)}
				onDragEnd={() => (draggedItem = null)}
				onDrop={handleDrop}
				onTouchDrop={handleTouchDrop}
				onItemClick={onItemClick}
			/>
		</div>
	{:else}
		<!-- Desktop: multi-column view -->
		<div class="desktop-columns">
			{#each columns as col (col)}
				<KanbanColumn
					status={col as FeedbackStatus}
					items={grouped[col as KanbanStatus] ?? []}
					{showWipWarnings}
					{showClaimIndicators}
					enableDrag={enableDragDrop}
					{cardSnippet}
					onDragStart={(item) => (draggedItem = item)}
					onDragEnd={() => (draggedItem = null)}
					onDrop={handleDrop}
					onItemClick={onItemClick}
				/>
			{/each}
		</div>

		<!-- Drop zones (visible when dragging) -->
		{#if draggedItem}
			<div class="drop-zones">
				{#if onArchive}
					<DropZone label="Archive" color="#6b7280" icon="&#128451;" onDrop={handleArchiveDrop} />
				{/if}
				{#if onDefer}
					<DropZone label="Defer" color="#f59e0b" icon="&#128338;" onDrop={handleDeferDrop} />
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Undo hint -->
	{#if showUndoHint}
		<div class="undo-hint" role="status">
			Press <kbd>Ctrl+Z</kbd> to undo
		</div>
	{/if}

	<!-- Defer dialog -->
	{#if showDeferDialog && itemToDefer}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="defer-overlay" onclick={() => (showDeferDialog = false)} onkeydown={() => {}}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="defer-dialog" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
				<h3 class="defer-title">Defer: {itemToDefer.title}</h3>

				<label class="defer-label" for="defer-date">Reactivate on</label>
				<input
					id="defer-date"
					class="defer-input"
					type="date"
					bind:value={deferDate}
					min={new Date().toISOString().split('T')[0]}
				/>

				<label class="defer-label" for="defer-notes">Notes (optional)</label>
				<textarea
					id="defer-notes"
					class="defer-input defer-textarea"
					bind:value={deferNotes}
					rows="3"
					placeholder="Why is this being deferred?"
				></textarea>

				<div class="defer-actions">
					<button class="defer-cancel" onclick={() => (showDeferDialog = false)}>Cancel</button>
					<button
						class="defer-submit"
						disabled={!deferDate || isSubmittingDefer}
						onclick={submitDefer}
					>
						{isSubmittingDefer ? 'Deferring...' : 'Defer'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.kanban-board {
		display: flex;
		flex-direction: column;
		height: 100%;
		position: relative;
	}

	/* ── Desktop columns ─────────────────────────────────── */
	.desktop-columns {
		display: flex;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-xs, 8px);
		flex: 1;
		overflow: hidden;
	}

	/* ── Mobile tabs ──────────────────────────────────────── */
	.mobile-tabs {
		display: flex;
		gap: 2px;
		padding: var(--fb-space-xs, 8px);
		overflow-x: auto;
		scrollbar-width: none;
		flex-shrink: 0;
	}

	.mobile-tabs::-webkit-scrollbar {
		display: none;
	}

	.mobile-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 12px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	.mobile-tab.active {
		border-color: var(--tab-color);
		color: var(--tab-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tab-color) 12%, transparent),
			color-mix(in srgb, var(--tab-color) 6%, transparent)
		);
		box-shadow: 0 0 8px color-mix(in srgb, var(--tab-color) 15%, transparent);
	}

	.tab-count {
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.mobile-column {
		flex: 1;
		padding: 0 var(--fb-space-xs, 8px) var(--fb-space-xs, 8px);
		overflow: hidden;
		display: flex;
	}

	.mobile-column :global(.kanban-column) {
		border: none;
		background: transparent;
	}

	/* ── Drop zones ──────────────────────────────────────── */
	.drop-zones {
		display: flex;
		gap: var(--fb-space-xs, 8px);
		padding: 0 var(--fb-space-xs, 8px) var(--fb-space-xs, 8px);
		animation: fadeIn var(--fb-duration-fast, 0.15s);
	}

	.drop-zones :global(.drop-zone) {
		flex: 1;
	}

	/* ── Loading skeleton ────────────────────────────────── */
	.loading-skeleton {
		display: flex;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-xs, 8px);
		flex: 1;
	}

	.skeleton-column {
		flex: 1;
		border-radius: var(--fb-radius-md, 12px);
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 30%, transparent) 0%,
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 60%, transparent) 50%,
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 30%, transparent) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.8s ease-in-out infinite;
		min-height: 200px;
	}

	/* ── Undo hint ───────────────────────────────────────── */
	.undo-hint {
		position: absolute;
		bottom: var(--fb-space-md, 16px);
		left: 50%;
		transform: translateX(-50%);
		padding: 6px 14px;
		border-radius: var(--fb-radius-sm, 8px);
		background: var(--theme-text, rgba(226, 232, 240, 0.95));
		color: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 500;
		animation: slideUp var(--fb-duration-normal, 0.3s) var(--fb-spring-bounce, ease);
		pointer-events: none;
		z-index: 10;
		backdrop-filter: blur(var(--fb-overlay-blur, 8px));
	}

	.undo-hint kbd {
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(0, 0, 0, 0.15);
		font-family: inherit;
		font-size: inherit;
	}

	/* ── Defer dialog ────────────────────────────────────── */
	.defer-overlay {
		position: absolute;
		inset: 0;
		background: var(--fb-overlay-bg, rgba(0, 0, 0, 0.6));
		backdrop-filter: blur(var(--fb-overlay-blur, 8px));
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		animation: fadeIn var(--fb-duration-fast, 0.15s);
	}

	.defer-dialog {
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		border-radius: var(--fb-radius-lg, 16px);
		padding: var(--fb-space-lg, 24px);
		width: clamp(320px, 90%, 480px);
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-sm, 12px);
		box-shadow:
			0 16px 48px rgba(0, 0, 0, 0.3),
			0 0 0 1px rgba(255, 255, 255, 0.06);
		animation: slideUp var(--fb-duration-normal, 0.3s) var(--fb-spring-bounce, ease);
	}

	.defer-title {
		font-size: var(--fb-text-lg, 1.125rem);
		font-weight: 700;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		margin: 0;
	}

	.defer-label {
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
	}

	.defer-input {
		padding: 8px 12px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-size: var(--fb-text-base, 1rem);
		font-family: inherit;
	}

	.defer-input:focus {
		outline: none;
		border-color: var(--fb-status-in-progress, #f59e0b);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--fb-status-in-progress, #f59e0b) 15%, transparent);
	}

	.defer-textarea {
		resize: vertical;
	}

	.defer-actions {
		display: flex;
		gap: var(--fb-space-xs, 8px);
		justify-content: flex-end;
		margin-top: var(--fb-space-xs, 8px);
	}

	.defer-cancel {
		padding: 8px 16px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-weight: 600;
		cursor: pointer;
	}

	.defer-submit {
		padding: 8px 16px;
		border-radius: var(--fb-radius-sm, 8px);
		border: none;
		background: var(--fb-status-in-progress, #f59e0b);
		color: #fff;
		font-weight: 700;
		cursor: pointer;
	}

	.defer-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── Animations ──────────────────────────────────────── */
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateX(-50%) translateY(12px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	@keyframes shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.undo-hint,
		.defer-overlay,
		.defer-dialog,
		.drop-zones,
		.skeleton-column {
			animation: none;
		}
		.mobile-tab {
			transition: none;
		}
	}
</style>
