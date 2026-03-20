<!--
	MediaSpotlightCurator.svelte — Wraps @austencloud/media-spotlight and adds:
	- Curator navigation (prev/next with progress)
	- Tag editing panel (using TagPickerPanel)
	- Info panel with editable fields (name, description, notes)
	- needsReview toggle
	- Keyboard shortcuts: Enter = confirm (mark reviewed), Arrow keys = navigate, E = toggle needs editing
-->
<script lang="ts">
	import TagPickerPanel from '../grid/TagPickerPanel.svelte';
	import type { MediaItem, MediaTag, CuratorProgress } from '../types.js';
	import { getTagHex } from '../types.js';

	interface Props {
		/** The current media item to display. */
		item: MediaItem | null;
		/** All items in the working set (for filmstrip navigation). */
		items: MediaItem[];
		/** Current index in the working set. */
		currentIndex: number;
		/** Available tags for the tag picker. */
		tags: MediaTag[];
		/** Curator progress info. */
		progress: CuratorProgress;
		/** Whether the spotlight is open. */
		open: boolean;
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string> | undefined;
		/** Whether navigation is possible. */
		canGoNext: boolean;
		canGoPrev: boolean;
		/** Callbacks */
		onclose: () => void;
		onnext: () => void;
		onprev: () => void;
		onchange: (index: number) => void;
		ontagtoggle: (item: MediaItem, tagId: string) => void;
		onneedsreview: (item: MediaItem, needsReview: boolean) => void;
		onrename?: (item: MediaItem, newName: string) => void;
		ondescription?: (item: MediaItem, description: string) => void;
		onnotes?: (item: MediaItem, notes: string) => void;
		ondelete?: (item: MediaItem) => void;
	}

	const {
		item,
		items,
		currentIndex,
		tags,
		progress,
		open,
		categories,
		categoryLabels,
		canGoNext,
		canGoPrev,
		onclose,
		onnext,
		onprev,
		onchange,
		ontagtoggle,
		onneedsreview,
		onrename,
		ondescription,
		onnotes,
		ondelete
	}: Props = $props();

	let showTagPanel = $state(true);
	let showInfoPanel = $state(false);
	let editingName = $state(false);
	let editingDescription = $state(false);
	let editingNotes = $state(false);
	let nameValue = $state('');
	let descriptionValue = $state('');
	let notesValue = $state('');

	// Tag objects for current item
	const currentItemTags = $derived(
		item ? tags.filter((t) => item.tags.includes(t.id)) : []
	);

	function handleTagApply(tag: MediaTag) {
		if (!item) return;
		if (!item.tags.includes(tag.id)) {
			ontagtoggle(item, tag.id);
		}
	}

	function handleTagRemove(tag: MediaTag) {
		if (!item) return;
		if (item.tags.includes(tag.id)) {
			ontagtoggle(item, tag.id);
		}
	}

	function handleToggleNeedsReview() {
		if (!item) return;
		onneedsreview(item, !item.needsReview);
	}

	function startEditName() {
		if (!item) return;
		nameValue = item.suggestedName || '';
		editingName = true;
	}

	function saveName() {
		if (!item || !onrename) return;
		const trimmed = nameValue.trim();
		if (trimmed && trimmed !== item.suggestedName) {
			onrename(item, trimmed);
		}
		editingName = false;
	}

	function startEditDescription() {
		if (!item) return;
		descriptionValue = item.description || '';
		editingDescription = true;
	}

	function saveDescription() {
		if (!item || !ondescription) return;
		ondescription(item, descriptionValue);
		editingDescription = false;
	}

	function startEditNotes() {
		if (!item) return;
		notesValue = item.notes || '';
		editingNotes = true;
	}

	function saveNotes() {
		if (!item || !onnotes) return;
		onnotes(item, notesValue);
		editingNotes = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		// Skip if user is typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				onnext();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				onprev();
				break;
			case 'Enter':
				e.preventDefault();
				// Mark as reviewed (toggle needsReview off)
				if (item?.needsReview) {
					onneedsreview(item, false);
				}
				// Auto-advance
				if (canGoNext) onnext();
				break;
			case 'e':
			case 'E':
				e.preventDefault();
				handleToggleNeedsReview();
				break;
			case 'Escape':
				onclose();
				break;
		}
	}
</script>

{#if open && item}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="curator-overlay" onkeydown={handleKeydown}>
		<!-- Main image area -->
		<div class="curator-main">
			<img
				src={item.url || item.thumbnailUrl || ''}
				alt={item.suggestedName || item.filename}
				class="curator-image"
			/>
		</div>

		<!-- Progress bar -->
		<div class="progress-bar">
			<div class="progress-fill" style="width: {progress.percent}%"></div>
		</div>
		<div class="progress-text">
			{progress.current} / {progress.total}
		</div>

		<!-- Navigation overlay buttons -->
		{#if canGoPrev}
			<button class="nav-btn nav-prev" onclick={onprev} aria-label="Previous item">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 19l-7-7 7-7" />
				</svg>
			</button>
		{/if}
		{#if canGoNext}
			<button class="nav-btn nav-next" onclick={onnext} aria-label="Next item">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/if}

		<!-- Top controls -->
		<div class="top-controls">
			<!-- Needs Review toggle -->
			<button
				class="review-toggle"
				class:active={item.needsReview}
				onclick={handleToggleNeedsReview}
				title="Toggle needs review (E)"
			>
				{item.needsReview ? 'Needs Review' : 'Reviewed'}
			</button>

			<!-- Panel toggles -->
			<button
				class="panel-toggle"
				class:active={showTagPanel}
				onclick={() => (showTagPanel = !showTagPanel)}
			>
				Tags
			</button>
			<button
				class="panel-toggle"
				class:active={showInfoPanel}
				onclick={() => (showInfoPanel = !showInfoPanel)}
			>
				Info
			</button>

			<!-- Close -->
			<button class="close-btn" onclick={onclose} aria-label="Close">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Tag panel (right side) -->
		{#if showTagPanel}
			<div class="side-panel right-panel">
				<TagPickerPanel
					{tags}
					selectedItems={[item]}
					{categories}
					{categoryLabels}
					onapply={handleTagApply}
					onremove={handleTagRemove}
				/>
			</div>
		{/if}

		<!-- Info panel (right side, below tags) -->
		{#if showInfoPanel}
			<div class="side-panel info-panel">
				<div class="info-section">
					<h3 class="info-label">Name</h3>
					{#if editingName}
						<input
							class="info-input"
							bind:value={nameValue}
							onblur={saveName}
							onkeydown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { editingName = false; } }}
						/>
					{:else}
						<button class="info-value" ondblclick={startEditName}>
							{item.suggestedName || item.filename}
						</button>
					{/if}
				</div>

				<div class="info-section">
					<h3 class="info-label">Description</h3>
					{#if editingDescription}
						<textarea
							class="info-textarea"
							bind:value={descriptionValue}
							onblur={saveDescription}
							onkeydown={(e) => { if (e.key === 'Escape') { editingDescription = false; } }}
						></textarea>
					{:else}
						<button class="info-value" ondblclick={startEditDescription}>
							{item.description || 'No description'}
						</button>
					{/if}
				</div>

				<div class="info-section">
					<h3 class="info-label">Notes</h3>
					{#if editingNotes}
						<textarea
							class="info-textarea"
							bind:value={notesValue}
							onblur={saveNotes}
							onkeydown={(e) => { if (e.key === 'Escape') { editingNotes = false; } }}
						></textarea>
					{:else}
						<button class="info-value" ondblclick={startEditNotes}>
							{item.notes || 'No notes'}
						</button>
					{/if}
				</div>

				{#if item.sizeFromFilename}
					<div class="info-section">
						<h3 class="info-label">Size (from filename)</h3>
						<span class="info-static">{item.sizeFromFilename}</span>
					</div>
				{/if}

				<!-- Current tags display -->
				{#if currentItemTags.length > 0}
					<div class="info-section">
						<h3 class="info-label">Tags</h3>
						<div class="info-tags">
							{#each currentItemTags as tag (tag.id)}
								<span
									class="info-tag"
									style="--tag-color: {getTagHex(tag)}"
								>
									<span class="info-tag-dot" style="background: {getTagHex(tag)}"></span>
									{tag.name}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if ondelete}
					<div class="info-section">
						<button class="delete-btn" onclick={() => ondelete(item)}>
							Delete Item
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Keyboard hints -->
		<div class="keyboard-hints">
			<span class="hint"><kbd>&#8592;</kbd><kbd>&#8594;</kbd> Navigate</span>
			<span class="hint"><kbd>Enter</kbd> Confirm</span>
			<span class="hint"><kbd>E</kbd> Toggle Edit</span>
			<span class="hint"><kbd>Esc</kbd> Close</span>
		</div>
	</div>
{/if}

<style>
	.curator-overlay {
		position: fixed;
		inset: 0;
		z-index: 1100;
		background: rgba(0, 0, 0, 0.95);
	}

	.curator-main {
		position: absolute;
		top: 28px;
		left: 60px;
		right: 310px;
		bottom: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.curator-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	/* Progress */
	.progress-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: rgba(255, 255, 255, 0.1);
		z-index: 1110;
	}

	.progress-fill {
		height: 100%;
		background: var(--mm-accent, #6366f1);
		transition: width 0.3s ease-out;
	}

	.progress-text {
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		padding: 2px 12px;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.6);
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		z-index: 1110;
	}

	/* Navigation */
	.nav-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 48px;
		height: 48px;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		color: white;
		cursor: pointer;
		z-index: 1110;
		transition: background 0.15s;
	}

	.nav-btn:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.nav-btn svg {
		width: 24px;
		height: 24px;
	}

	.nav-prev {
		left: 16px;
	}

	.nav-next {
		right: 16px;
	}

	/* Top controls */
	.top-controls {
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 1110;
	}

	.review-toggle {
		padding: 6px 14px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.review-toggle.active {
		background: color-mix(in srgb, var(--mm-warning, #f59e0b) 20%, transparent);
		border-color: var(--mm-warning, #f59e0b);
		color: var(--mm-warning, #f59e0b);
	}

	.panel-toggle {
		padding: 6px 14px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.panel-toggle.active {
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 20%, transparent);
		border-color: var(--mm-accent, #6366f1);
		color: var(--mm-accent, #6366f1);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		color: white;
		cursor: pointer;
		transition: background 0.15s;
	}

	.close-btn:hover {
		background: rgba(0, 0, 0, 0.7);
	}

	.close-btn svg {
		width: 20px;
		height: 20px;
	}

	/* Side panels */
	.side-panel {
		position: absolute;
		top: 60px;
		right: 16px;
		width: 280px;
		max-height: calc(100vh - 140px);
		z-index: 1110;
	}

	.right-panel {
		top: 60px;
		overflow-y: auto;
	}

	.info-panel {
		top: 60px;
		right: 308px;
		background: var(--mm-surface-raised, #222240);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 8px;
		padding: 16px;
		overflow-y: auto;
	}

	.info-section {
		margin-bottom: 16px;
	}

	.info-section:last-child {
		margin-bottom: 0;
	}

	.info-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mm-text-muted, #9999b0);
		margin: 0 0 4px;
	}

	.info-value {
		display: block;
		width: 100%;
		padding: 4px 8px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--mm-text, #e8e8f0);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.info-value:hover {
		border-color: var(--mm-border, #333355);
	}

	.info-input {
		width: 100%;
		padding: 4px 8px;
		border: 1px solid var(--mm-accent, #6366f1);
		border-radius: 4px;
		background: var(--mm-surface, #1a1a2e);
		color: var(--mm-text, #e8e8f0);
		font-size: 13px;
		font-family: inherit;
		outline: none;
	}

	.info-textarea {
		width: 100%;
		min-height: 60px;
		padding: 4px 8px;
		border: 1px solid var(--mm-accent, #6366f1);
		border-radius: 4px;
		background: var(--mm-surface, #1a1a2e);
		color: var(--mm-text, #e8e8f0);
		font-size: 13px;
		font-family: inherit;
		outline: none;
		resize: vertical;
	}

	.info-static {
		font-size: 13px;
		color: var(--mm-text, #e8e8f0);
	}

	.info-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.info-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--tag-color) 20%, transparent);
		border: 1px solid color-mix(in srgb, var(--tag-color) 40%, transparent);
		font-size: 11px;
		color: var(--mm-text, #e8e8f0);
	}

	.info-tag-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.delete-btn {
		width: 100%;
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--mm-danger, #ef4444) 40%, transparent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--mm-danger, #ef4444) 10%, transparent);
		color: var(--mm-danger, #ef4444);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.delete-btn:hover {
		background: color-mix(in srgb, var(--mm-danger, #ef4444) 20%, transparent);
	}

	/* Keyboard hints */
	.keyboard-hints {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 16px;
		padding: 6px 16px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.6);
		z-index: 1110;
	}

	.hint {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
	}

	.hint kbd {
		padding: 1px 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
		font-size: 10px;
		font-family: inherit;
	}
</style>
