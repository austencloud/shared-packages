/**
 * Swim lane classifier.
 *
 * Routes feedback items into visual swim lanes based on priority, type, and source.
 * Ported from TKA's SwimLaneDeriver service.
 *
 * Lanes:
 *   - critical: priority=critical AND type=bug
 *   - internal: source=terminal (CLI dev work)
 *   - backlog:  priority=low OR has deferredUntil
 *   - normal:   everything else
 */

import type { FeedbackItem, SwimLane } from '@austencloud/feedback-types';

/**
 * Derive which swim lane an item belongs to.
 */
export function deriveLane(item: FeedbackItem): SwimLane {
	// Critical bugs are top priority
	if (item.priority === 'critical' && item.type === 'bug') {
		return 'critical';
	}

	// Terminal/CLI-submitted items are internal work
	if (item.source === 'terminal') {
		return 'internal';
	}

	// Low priority or deferred items go to backlog
	if (item.priority === 'low' || item.deferredUntil) {
		return 'backlog';
	}

	return 'normal';
}

/**
 * Group items by their swim lane.
 */
export function groupByLane(items: FeedbackItem[]): Record<SwimLane, FeedbackItem[]> {
	const groups: Record<SwimLane, FeedbackItem[]> = {
		critical: [],
		normal: [],
		internal: [],
		backlog: [],
	};

	for (const item of items) {
		const lane = deriveLane(item);
		groups[lane].push(item);
	}

	return groups;
}
