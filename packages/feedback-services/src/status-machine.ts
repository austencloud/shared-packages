/**
 * Status machine — validates and executes status transitions.
 *
 * Wraps the VALID_TRANSITIONS config with richer logic:
 *   - Transition validation with error messages
 *   - Status history entry creation
 *   - Batch status updates via repository
 */

import type {
	FeedbackItem,
	FeedbackStatus,
	StatusHistoryEntry,
} from '@austencloud/feedback-types';
import {
	isValidTransition,
	getValidNextStatuses,
	VALID_TRANSITIONS,
} from '@austencloud/feedback-types';
import type { IFeedbackRepository } from './repository.js';

// ── Transition result ──────────────────────────────────────────────

export interface TransitionResult {
	success: boolean;
	error?: string;
	fromStatus: FeedbackStatus;
	toStatus: FeedbackStatus;
}

/**
 * Validate a status transition without executing it.
 */
export function validateTransition(
	from: FeedbackStatus,
	to: FeedbackStatus
): TransitionResult {
	if (from === to) {
		return { success: false, error: `Already in status "${from}"`, fromStatus: from, toStatus: to };
	}

	if (!isValidTransition(from, to)) {
		const allowed = getValidNextStatuses(from);
		const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none';
		return {
			success: false,
			error: `Cannot transition from "${from}" to "${to}". Allowed: ${allowedStr}`,
			fromStatus: from,
			toStatus: to,
		};
	}

	return { success: true, fromStatus: from, toStatus: to };
}

/**
 * Execute a status transition: validate, build history entry, and persist.
 */
export async function executeTransition(
	repo: IFeedbackRepository,
	itemId: string,
	toStatus: FeedbackStatus,
	changedBy: string,
	notes?: string
): Promise<TransitionResult> {
	const item = await repo.getById(itemId);
	if (!item) {
		return {
			success: false,
			error: `Feedback item "${itemId}" not found`,
			fromStatus: 'new',
			toStatus,
		};
	}

	const validation = validateTransition(item.status, toStatus);
	if (!validation.success) return validation;

	const historyEntry: StatusHistoryEntry = {
		fromStatus: item.status,
		toStatus,
		changedBy,
		changedAt: new Date(),
		notes,
	};

	const existingHistory = item.statusHistory ?? [];

	await repo.update(itemId, {
		status: toStatus,
		updatedAt: new Date(),
		statusHistory: [...existingHistory, historyEntry],
	});

	return { success: true, fromStatus: item.status, toStatus };
}

// Re-export for convenience
export { isValidTransition, getValidNextStatuses } from '@austencloud/feedback-types';
