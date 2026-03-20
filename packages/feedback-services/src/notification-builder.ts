/**
 * Notification builder.
 *
 * Builds notification payloads for feedback status changes.
 * Does NOT deliver notifications — consumers handle delivery
 * (Firestore write, email, push, etc.).
 */

import type { FeedbackItem, FeedbackStatus } from '@austencloud/feedback-types';

// ── Notification types ─────────────────────────────────────────────

export type FeedbackNotificationType =
	| 'feedback-resolved'
	| 'feedback-in-progress'
	| 'feedback-needs-info'
	| 'feedback-response'
	| 'feedback-released';

export interface FeedbackNotificationPayload {
	type: FeedbackNotificationType;
	recipientUserId: string;
	feedbackId: string;
	feedbackTitle: string;
	message: string;
	createdAt: Date;
	fromUserId?: string;
	fromUserName?: string;
}

// ── Builder ────────────────────────────────────────────────────────

/**
 * Build a notification payload for a status change.
 * Returns null if no notification should be sent (e.g., internal transitions).
 */
export function buildStatusChangeNotification(
	item: FeedbackItem,
	newStatus: FeedbackStatus,
	changedByName?: string
): FeedbackNotificationPayload | null {
	const base = {
		recipientUserId: item.userId,
		feedbackId: item.id,
		feedbackTitle: item.title,
		createdAt: new Date(),
		fromUserName: changedByName,
	};

	switch (newStatus) {
		case 'in-progress':
			return {
				...base,
				type: 'feedback-in-progress',
				message: `Your feedback "${item.title}" is being worked on.`,
			};

		case 'in-review':
			return {
				...base,
				type: 'feedback-needs-info',
				message: `Your feedback "${item.title}" is in review. You may be asked to verify the fix.`,
			};

		case 'completed':
			return {
				...base,
				type: 'feedback-resolved',
				message: item.resolutionNotes
					? `Your feedback "${item.title}" has been resolved: ${item.resolutionNotes}`
					: `Your feedback "${item.title}" has been resolved.`,
			};

		default:
			// No notification for new, archived, or other transitions
			return null;
	}
}

/**
 * Build a notification payload for an admin response to a feedback item.
 */
export function buildAdminResponseNotification(
	item: FeedbackItem,
	responseMessage: string,
	adminName: string
): FeedbackNotificationPayload {
	return {
		type: 'feedback-response',
		recipientUserId: item.userId,
		feedbackId: item.id,
		feedbackTitle: item.title,
		message: `${adminName} responded to your feedback "${item.title}": ${responseMessage}`,
		createdAt: new Date(),
		fromUserName: adminName,
	};
}

/**
 * Build a notification for a version release that included this feedback.
 */
export function buildReleaseNotification(
	item: FeedbackItem,
	version: string,
	projectName: string = 'the project'
): FeedbackNotificationPayload {
	return {
		type: 'feedback-released',
		recipientUserId: item.userId,
		feedbackId: item.id,
		feedbackTitle: item.title,
		message: `Your feedback was included in version ${version}! Thank you for helping improve ${projectName}.`,
		createdAt: new Date(),
	};
}
