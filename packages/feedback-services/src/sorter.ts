/**
 * Feedback sorting and grouping.
 *
 * Sorts by priority and groups items by their effective (claim-aware) status.
 * Ported from TKA's FeedbackSorter service.
 */

import type {
	FeedbackItem,
	FeedbackStatus,
} from '@austencloud/feedback-types';
import { PRIORITY_ORDER } from '@austencloud/feedback-types';
import { deriveEffectiveStatus } from './claim-deriver.js';

/** Active kanban statuses (everything except archived). */
const KANBAN_STATUSES: FeedbackStatus[] = ['new', 'in-progress', 'in-review', 'completed'];

type KanbanStatus = 'new' | 'in-progress' | 'in-review' | 'completed';

// ── Sort by priority ───────────────────────────────────────────────

/**
 * Sort items by priority: no-priority first (forces triage), then high → medium → low.
 * Secondary sort by createdAt ascending (oldest first within same priority).
 */
export function sortByPriority(items: FeedbackItem[]): FeedbackItem[] {
	return [...items].sort((a, b) => {
		const aPriority = PRIORITY_ORDER.indexOf(a.priority ?? '');
		const bPriority = PRIORITY_ORDER.indexOf(b.priority ?? '');

		if (aPriority !== bPriority) return aPriority - bPriority;

		return a.createdAt.getTime() - b.createdAt.getTime();
	});
}

// ── Group by effective status ──────────────────────────────────────

/**
 * Group items by their effective (claim-aware) display status.
 * Filters out deleted and archived items. Sorts each group by priority.
 */
export function groupByStatus(
	items: FeedbackItem[],
	now: Date = new Date()
): Record<KanbanStatus, FeedbackItem[]> {
	const groups: Record<KanbanStatus, FeedbackItem[]> = {
		new: [],
		'in-progress': [],
		'in-review': [],
		completed: [],
	};

	for (const item of items) {
		if (item.isDeleted) continue;
		if (item.status === 'archived') continue;

		const { displayStatus } = deriveEffectiveStatus(item, now);

		if (displayStatus in groups) {
			groups[displayStatus as KanbanStatus].push(item);
		}
	}

	// Sort each column by priority
	for (const status of KANBAN_STATUSES) {
		groups[status as KanbanStatus] = sortByPriority(groups[status as KanbanStatus]);
	}

	return groups;
}

// ── Deferred items ─────────────────────────────────────────────────

/**
 * Get items that are currently deferred (have a future deferredUntil date).
 */
export function getDeferredItems(
	items: FeedbackItem[],
	now: Date = new Date()
): FeedbackItem[] {
	return items.filter(
		(item) =>
			item.deferredUntil &&
			item.deferredUntil.getTime() > now.getTime() &&
			!item.isDeleted
	);
}

/**
 * Get items whose deferral has expired and should be reactivated.
 */
export function getExpiredDeferrals(
	items: FeedbackItem[],
	now: Date = new Date()
): FeedbackItem[] {
	return items.filter(
		(item) =>
			item.deferredUntil &&
			item.deferredUntil.getTime() <= now.getTime() &&
			item.status === 'archived' &&
			item.archiveReason === 'deferred' &&
			!item.isDeleted
	);
}
