// ── Main components ────────────────────────────────────────────────
export { default as SubmitFeedback } from './SubmitFeedback.svelte';
export { default as MyFeedback } from './MyFeedback.svelte';
export { default as KanbanBoard } from './KanbanBoard.svelte';
export { default as FeedbackDetail } from './FeedbackDetail.svelte';

// ── Shared primitives ──────────────────────────────────────────────
export { default as StatusBadge } from './shared/StatusBadge.svelte';
export { default as TypeBadge } from './shared/TypeBadge.svelte';
export { default as PriorityBadge } from './shared/PriorityBadge.svelte';
export { default as DateDisplay } from './shared/DateDisplay.svelte';

// ── Sub-components (for advanced composition) ──────────────────────
export { default as TypeSelector } from './submit/TypeSelector.svelte';
export { default as PriorityPills } from './submit/PriorityPills.svelte';
export { default as SubmitButton } from './submit/SubmitButton.svelte';
export { default as KanbanColumn } from './kanban/KanbanColumn.svelte';
export { default as KanbanCard } from './kanban/KanbanCard.svelte';
export { default as ColumnHeader } from './kanban/ColumnHeader.svelte';
export { default as FilterBar } from './kanban/FilterBar.svelte';
export { default as DropZone } from './kanban/DropZone.svelte';
export { default as FeedbackCard } from './my-feedback/FeedbackCard.svelte';
export { default as StatusTimeline } from './my-feedback/StatusTimeline.svelte';
export { default as EmptyState } from './my-feedback/EmptyState.svelte';

// ── State ──────────────────────────────────────────────────────────
export { createFeedbackState } from './state/feedback-state.svelte.js';
export type { FeedbackState } from './state/feedback-state.svelte.js';

// ── Prop types ─────────────────────────────────────────────────────
export type {
	SubmitFeedbackProps,
	MyFeedbackProps,
	KanbanBoardProps,
	FeedbackDetailProps,
	KanbanColumnConfig,
	KanbanStatus,
} from './types.js';
