<script lang="ts">
	import type { FeedbackItem, FeedbackStatus, ArchiveReason } from '@austencloud/feedback-types';
	import { STATUS_DISPLAY, ARCHIVE_REASON_DISPLAY, ARCHIVE_REASONS } from '@austencloud/feedback-types';
	import { getValidNextStatuses } from '@austencloud/feedback-types';
	import type { FeedbackDetailProps } from './types.js';
	import StatusBadge from './shared/StatusBadge.svelte';
	import TypeBadge from './shared/TypeBadge.svelte';
	import PriorityBadge from './shared/PriorityBadge.svelte';
	import DateDisplay from './shared/DateDisplay.svelte';
	import StatusTimeline from './my-feedback/StatusTimeline.svelte';

	const {
		item,
		onClose,
		onStatusChange,
		onUpdate,
		onArchive,
		readOnly = false,
	}: FeedbackDetailProps = $props();

	let isEditing = $state(false);
	let editTitle = $state(item.title);
	let editDescription = $state(item.description);
	let editAdminNotes = $state(item.adminNotes ?? '');
	let showArchiveDialog = $state(false);
	let archiveReason = $state<ArchiveReason>('released');
	let archiveNotes = $state('');

	const validNextStatuses = $derived(getValidNextStatuses(item.status));

	async function saveEdits() {
		if (!onUpdate) return;
		await onUpdate(item.id, {
			title: editTitle.trim(),
			description: editDescription.trim(),
			adminNotes: editAdminNotes.trim() || undefined,
		});
		isEditing = false;
	}

	function cancelEdit() {
		editTitle = item.title;
		editDescription = item.description;
		editAdminNotes = item.adminNotes ?? '';
		isEditing = false;
	}

	async function handleStatusChange(newStatus: FeedbackStatus) {
		await onStatusChange?.(item.id, newStatus);
	}

	async function handleArchive() {
		if (!onArchive) return;
		await onArchive(item.id, archiveReason, archiveNotes.trim() || undefined);
		showArchiveDialog = false;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="detail-overlay" onclick={onClose} onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="detail-panel" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
		<!-- Header -->
		<div class="panel-header">
			<div class="header-badges">
				<TypeBadge type={item.type} />
				<StatusBadge status={item.status} />
				{#if item.priority}
					<PriorityBadge priority={item.priority} />
				{/if}
			</div>
			<button class="close-btn" onclick={onClose} aria-label="Close">&#x2715;</button>
		</div>

		<!-- Content -->
		<div class="panel-body">
			{#if isEditing}
				<input
					class="edit-title"
					type="text"
					bind:value={editTitle}
				/>
				<textarea
					class="edit-description"
					bind:value={editDescription}
					rows="6"
				></textarea>
				<label class="field-label">Admin Notes</label>
				<textarea
					class="edit-notes"
					bind:value={editAdminNotes}
					rows="3"
					placeholder="Internal notes (not visible to submitter)"
				></textarea>
				<div class="edit-actions">
					<button class="btn-secondary" onclick={cancelEdit}>Cancel</button>
					<button class="btn-primary" onclick={saveEdits}>Save</button>
				</div>
			{:else}
				<h2 class="detail-title">{item.title}</h2>
				<p class="detail-description">{item.description}</p>

				{#if item.adminNotes}
					<div class="admin-notes">
						<span class="field-label">Admin Notes</span>
						<p>{item.adminNotes}</p>
					</div>
				{/if}

				{#if item.resolutionNotes}
					<div class="resolution-notes">
						<span class="field-label">Resolution</span>
						<p>{item.resolutionNotes}</p>
					</div>
				{/if}
			{/if}

			<!-- Metadata -->
			<div class="metadata">
				<div class="meta-row">
					<span class="meta-label">Submitted by</span>
					<span class="meta-value">{item.userDisplayName}</span>
				</div>
				<div class="meta-row">
					<span class="meta-label">Created</span>
					<DateDisplay date={item.createdAt} relative={false} />
				</div>
				{#if item.fixedInVersion}
					<div class="meta-row">
						<span class="meta-label">Fixed in</span>
						<span class="version-tag">v{item.fixedInVersion}</span>
					</div>
				{/if}
			</div>

			<!-- Timeline -->
			{#if item.statusHistory?.length || item.status !== 'new'}
				<div class="timeline-section">
					<span class="field-label">Status History</span>
					<StatusTimeline
						history={item.statusHistory}
						currentStatus={item.status}
						createdAt={item.createdAt}
					/>
				</div>
			{/if}
		</div>

		<!-- Action bar -->
		{#if !readOnly}
			<div class="action-bar">
				{#if !isEditing && onUpdate}
					<button class="btn-secondary" onclick={() => (isEditing = true)}>Edit</button>
				{/if}

				{#if validNextStatuses.length > 0 && onStatusChange}
					<div class="status-actions">
						{#each validNextStatuses as nextStatus (nextStatus)}
							{@const config = STATUS_DISPLAY[nextStatus]}
							<button
								class="btn-status"
								style:--btn-color={config.color}
								onclick={() => handleStatusChange(nextStatus)}
							>
								Move to {config.label}
							</button>
						{/each}
					</div>
				{/if}

				{#if onArchive && item.status !== 'archived'}
					<button class="btn-archive" onclick={() => (showArchiveDialog = true)}>Archive</button>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Archive dialog -->
{#if showArchiveDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="archive-overlay" onclick={() => (showArchiveDialog = false)} onkeydown={() => {}}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="archive-dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<h3>Archive: {item.title}</h3>
			<label class="field-label" for="archive-reason">Reason</label>
			<select id="archive-reason" class="archive-select" bind:value={archiveReason}>
				{#each ARCHIVE_REASONS as reason (reason)}
					<option value={reason}>{ARCHIVE_REASON_DISPLAY[reason].label}</option>
				{/each}
			</select>
			<label class="field-label" for="archive-notes">Notes (optional)</label>
			<textarea
				id="archive-notes"
				class="archive-textarea"
				bind:value={archiveNotes}
				rows="2"
			></textarea>
			<div class="archive-actions">
				<button class="btn-secondary" onclick={() => (showArchiveDialog = false)}>Cancel</button>
				<button class="btn-archive" onclick={handleArchive}>Archive</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── Overlay ──────────────────────────────────────────── */
	.detail-overlay {
		position: fixed;
		inset: 0;
		background: var(--fb-overlay-bg, rgba(0, 0, 0, 0.6));
		backdrop-filter: blur(var(--fb-overlay-blur, 8px));
		z-index: 200;
		display: flex;
		justify-content: flex-end;
		animation: fadeIn var(--fb-duration-fast, 0.15s);
	}

	.detail-panel {
		width: clamp(360px, 40vw, 560px);
		height: 100%;
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		box-shadow:
			-8px 0 32px rgba(0, 0, 0, 0.25),
			-1px 0 0 rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideIn var(--fb-duration-normal, 0.3s) var(--fb-spring, ease);
	}

	/* ── Header ──────────────────────────────────────────── */
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--fb-space-sm, 12px) var(--fb-space-md, 16px);
		border-bottom: 1px solid transparent;
		border-image: linear-gradient(
			90deg,
			transparent,
			var(--theme-stroke, rgba(255, 255, 255, 0.08)),
			transparent
		) 1;
		flex-shrink: 0;
	}

	.header-badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.close-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: 16px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background var(--fb-duration-fast, 0.15s);
	}

	.close-btn:hover {
		background: var(--theme-card-hover-bg, rgba(40, 40, 52, 0.95));
	}

	/* ── Body ────────────────────────────────────────────── */
	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--fb-space-md, 16px);
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-md, 16px);
	}

	.detail-title {
		font-size: var(--fb-text-lg, 1.125rem);
		font-weight: 700;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		margin: 0;
	}

	.detail-description {
		font-size: var(--fb-text-sm, 0.875rem);
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		margin: 0;
		line-height: 1.6;
		white-space: pre-wrap;
		opacity: 0.85;
	}

	.field-label {
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.admin-notes, .resolution-notes {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--fb-space-xs, 8px);
		border-radius: var(--fb-radius-sm, 8px);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 30%, transparent),
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 15%, transparent)
		);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
	}

	.admin-notes p, .resolution-notes p {
		margin: 0;
		font-size: var(--fb-text-sm, 0.875rem);
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		opacity: 0.85;
	}

	/* ── Metadata ────────────────────────────────────────── */
	.metadata {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.meta-label {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	.meta-value {
		font-size: var(--fb-text-sm, 0.875rem);
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-weight: 500;
	}

	.version-tag {
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 100px;
		background: color-mix(in srgb, var(--semantic-success, #10b981) 12%, transparent);
		color: var(--semantic-success, #10b981);
		box-shadow: 0 0 8px color-mix(in srgb, var(--semantic-success, #10b981) 15%, transparent);
	}

	.timeline-section {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-xs, 8px);
	}

	/* ── Edit mode ───────────────────────────────────────── */
	.edit-title, .edit-description, .edit-notes {
		padding: 8px 12px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-size: var(--fb-text-sm, 0.875rem);
		font-family: inherit;
	}

	.edit-title {
		font-size: var(--fb-text-lg, 1.125rem);
		font-weight: 700;
	}

	.edit-description, .edit-notes {
		resize: vertical;
		line-height: 1.5;
	}

	.edit-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	/* ── Action bar ──────────────────────────────────────── */
	.action-bar {
		display: flex;
		align-items: center;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-sm, 12px) var(--fb-space-md, 16px);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.status-actions {
		display: flex;
		gap: 6px;
		flex: 1;
	}

	/* ── Buttons ──────────────────────────────────────────── */
	.btn-primary {
		padding: 6px 14px;
		border-radius: var(--fb-radius-sm, 8px);
		border: none;
		background: var(--fb-status-new, #3b82f6);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-secondary {
		padding: 6px 14px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-weight: 600;
		cursor: pointer;
	}

	.btn-status {
		padding: 6px 12px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--btn-color);
		background: color-mix(in srgb, var(--btn-color) 8%, transparent);
		color: var(--btn-color);
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		cursor: pointer;
		transition: box-shadow var(--fb-duration-fast, 0.15s);
	}

	.btn-status:hover {
		box-shadow: 0 0 12px color-mix(in srgb, var(--btn-color) 20%, transparent);
	}

	.btn-archive {
		padding: 6px 14px;
		border-radius: var(--fb-radius-sm, 8px);
		border: none;
		background: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		color: #fff;
		font-weight: 600;
		cursor: pointer;
		margin-left: auto;
	}

	/* ── Archive dialog ──────────────────────────────────── */
	.archive-overlay {
		position: fixed;
		inset: 0;
		background: var(--fb-overlay-bg, rgba(0, 0, 0, 0.6));
		backdrop-filter: blur(var(--fb-overlay-blur, 8px));
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.archive-dialog {
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		border-radius: var(--fb-radius-lg, 16px);
		padding: var(--fb-space-lg, 24px);
		width: clamp(300px, 90%, 440px);
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-sm, 12px);
		box-shadow:
			0 16px 48px rgba(0, 0, 0, 0.3),
			0 0 0 1px rgba(255, 255, 255, 0.06);
	}

	.archive-dialog h3 {
		margin: 0;
		font-size: var(--fb-text-lg, 1.125rem);
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
	}

	.archive-select, .archive-textarea {
		padding: 8px 12px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-family: inherit;
		font-size: var(--fb-text-sm, 0.875rem);
	}

	.archive-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	/* ── Animations ──────────────────────────────────────── */
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-overlay, .detail-panel { animation: none; }
		.btn-status { transition: none; }
		.close-btn { transition: none; }
	}
</style>
