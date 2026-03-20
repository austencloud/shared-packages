/**
 * Type guards and validation utilities for feedback domain types.
 */

import type {
	FeedbackStatus,
	FeedbackType,
	FeedbackPriority,
	ArchiveReason,
	ClaimHealth,
} from './enums.js';
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, FEEDBACK_PRIORITIES, ARCHIVE_REASONS } from './enums.js';
import { VALID_TRANSITIONS, STALE_THRESHOLDS } from './config.js';
import type { FeedbackItem } from './models.js';

// ── Type guards ────────────────────────────────────────────────────

export function isFeedbackStatus(value: string): value is FeedbackStatus {
	return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function isFeedbackType(value: string): value is FeedbackType {
	return (FEEDBACK_TYPES as readonly string[]).includes(value);
}

export function isFeedbackPriority(value: string): value is FeedbackPriority {
	return (FEEDBACK_PRIORITIES as readonly string[]).includes(value);
}

export function isArchiveReason(value: string): value is ArchiveReason {
	return (ARCHIVE_REASONS as readonly string[]).includes(value);
}

// ── Transition validation ──────────────────────────────────────────

export function isValidTransition(from: FeedbackStatus, to: FeedbackStatus): boolean {
	const allowed = VALID_TRANSITIONS[from];
	return allowed !== undefined && allowed.includes(to);
}

export function getValidNextStatuses(current: FeedbackStatus): readonly FeedbackStatus[] {
	return VALID_TRANSITIONS[current] ?? [];
}

// ── Claim staleness ────────────────────────────────────────────────

export interface StalenessResult {
	isStale: boolean;
	reason: 'no-activity' | 'exceeded-max-time' | null;
	activityAgeMs: number;
	claimAgeMs: number;
}

/**
 * Check if a claim is stale based on activity timeout and hard cap.
 */
export function checkClaimStaleness(
	claimedAt: Date,
	lastActivity: Date | undefined,
	now: Date = new Date()
): StalenessResult {
	const activity = lastActivity ?? claimedAt;
	const activityAgeMs = now.getTime() - activity.getTime();
	const claimAgeMs = now.getTime() - claimedAt.getTime();

	if (claimAgeMs > STALE_THRESHOLDS.TOTAL_CLAIM_MAX_MS) {
		return { isStale: true, reason: 'exceeded-max-time', activityAgeMs, claimAgeMs };
	}

	if (activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS) {
		return { isStale: true, reason: 'no-activity', activityAgeMs, claimAgeMs };
	}

	return { isStale: false, reason: null, activityAgeMs, claimAgeMs };
}

/**
 * Check if a claim is approaching staleness (for warning UI).
 */
export function isApproachingStale(
	lastActivity: Date | undefined,
	claimedAt: Date | undefined,
	now: Date = new Date()
): boolean {
	const activity = lastActivity ?? claimedAt;
	if (!activity) return false;
	const ageMs = now.getTime() - activity.getTime();
	return ageMs > STALE_THRESHOLDS.WARNING_THRESHOLD_MS;
}

/**
 * Derive the claim health of a feedback item.
 */
export function getClaimHealth(item: FeedbackItem, now: Date = new Date()): ClaimHealth {
	if (!item.claimedBy && !item.claimToken) {
		if (item.status === 'in-progress') return 'orphaned';
		return 'none';
	}

	if (!item.claimedAt) return 'orphaned';

	const { isStale } = checkClaimStaleness(item.claimedAt, item.lastActivity, now);
	return isStale ? 'stale' : 'active';
}

// ── Formatting utilities ───────────────────────────────────────────

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
	if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
	if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.round((ms % 3_600_000) / 60_000);
	return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
