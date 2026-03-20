/**
 * Claim status deriver.
 *
 * Transforms stored status + claim state into an "effective" display status.
 * This is the core logic that makes the kanban board claim-aware:
 *   - Active claim → display as "in-progress"
 *   - Stale/orphaned claim on in-progress → revert to "new"
 *   - Other statuses pass through unchanged
 *
 * Ported from TKA's ClaimStatusDeriver service.
 */

import type {
	FeedbackItem,
	FeedbackStatus,
	EffectiveStatus,
	ClaimHealth,
} from '@austencloud/feedback-types';
import { getClaimHealth, checkClaimStaleness } from '@austencloud/feedback-types';

/**
 * Derive the effective display status for a feedback item.
 *
 * The stored status may differ from what should be displayed because
 * the claim system overlays behavior on top of raw status.
 */
export function deriveEffectiveStatus(item: FeedbackItem, now: Date = new Date()): EffectiveStatus {
	const claimHealth = getClaimHealth(item, now);
	const storedStatus = item.status;
	let displayStatus: FeedbackStatus = storedStatus;

	switch (claimHealth) {
		case 'active':
			// Active claim always shows as in-progress
			if (storedStatus === 'new') {
				displayStatus = 'in-progress';
			}
			break;

		case 'stale':
		case 'orphaned':
			// Stale/orphaned claims on in-progress revert to new
			if (storedStatus === 'in-progress') {
				displayStatus = 'new';
			}
			break;

		case 'none':
			// No claim — pass through stored status
			break;
	}

	let claimAgeMs: number | undefined;
	if (item.claimedAt) {
		claimAgeMs = now.getTime() - item.claimedAt.getTime();
	}

	const claimTokenShort = item.claimToken?.slice(0, 8);

	return {
		displayStatus,
		storedStatus,
		claimHealth,
		claimAgeMs,
		claimTokenShort,
	};
}

/**
 * Check if an item has an active (non-stale) claim.
 */
export function hasActiveClaim(item: FeedbackItem, now: Date = new Date()): boolean {
	return getClaimHealth(item, now) === 'active';
}

/**
 * Check if an item's claim is stale.
 */
export function isClaimStale(item: FeedbackItem, now: Date = new Date()): boolean {
	return getClaimHealth(item, now) === 'stale';
}

/**
 * Count items with active claims (for WIP limit enforcement).
 */
export function countActiveClaims(items: FeedbackItem[], now: Date = new Date()): number {
	return items.filter((item) => hasActiveClaim(item, now)).length;
}

/**
 * Get detailed staleness info for an item's claim.
 */
export function getClaimStalenessInfo(item: FeedbackItem, now: Date = new Date()) {
	if (!item.claimedAt) return null;
	return checkClaimStaleness(item.claimedAt, item.lastActivity, now);
}
