/**
 * Feedback system configuration constants.
 *
 * Single source of truth for claim thresholds, WIP limits, valid transitions,
 * swim lane config, and journal types. Previously duplicated across:
 *   - TKA: src/lib/features/feedback/config/claim-config.ts
 *   - CLI: config/feedback.config.js
 *   - Cirque: config/feedback.config.js
 *
 * Deployment-specific values (admin user, message templates) stay in each app.
 */

import type { FeedbackStatus, SwimLane, JournalType } from './enums.js';

// ── Claim management ───────────────────────────────────────────────

/**
 * Claims are considered "stale" (abandonable) when:
 * 1. No activity for ACTIVITY_TIMEOUT_MS (45 min), OR
 * 2. Total claim time exceeds TOTAL_CLAIM_MAX_MS (8 hours)
 *
 * The activity-based check catches crashed/abandoned sessions.
 * The hard cap prevents indefinite claim hoarding.
 */
export const STALE_THRESHOLDS = {
	/** No activity for this long = stale (agent likely crashed or forgot) */
	ACTIVITY_TIMEOUT_MS: 45 * 60 * 1000,
	/** Hard cap on total claim time, even with activity */
	TOTAL_CLAIM_MAX_MS: 8 * 60 * 60 * 1000,
	/** Show warning when approaching staleness */
	WARNING_THRESHOLD_MS: 30 * 60 * 1000,
	/** How long a claim request waits before auto-approving */
	REQUEST_WAIT_MS: 15 * 60 * 1000,
} as const;

export const AGENT_SESSION_CONFIG = {
	/** How long an agent session can be inactive before cleanup */
	SESSION_TIMEOUT_MS: 60 * 60 * 1000,
	/** Valid agent types that can register sessions */
	VALID_AGENT_TYPES: ['claude-cli', 'human', 'ci'] as const,
} as const;

export const EMERGENCY_CONFIG = {
	/** Cooldown between emergency actions (prevents abuse) */
	COOLDOWN_MS: 60 * 60 * 1000,
	/** Whether to require double confirmation for emergency actions */
	REQUIRE_CONFIRMATION: true,
} as const;

// ── WIP limits ─────────────────────────────────────────────────────

/**
 * Soft limits per Kanban column.
 * Shows warning when exceeded but allows override.
 */
export const WIP_LIMITS: Readonly<Record<string, number>> = {
	new: 0,
	'in-progress': 4,
	'in-review': 5,
	completed: 0,
};

// ── Status transitions ─────────────────────────────────────────────

/**
 * Allowed status changes in the feedback lifecycle.
 * Any transition not in this map is invalid and will be rejected.
 */
export const VALID_TRANSITIONS: Readonly<Record<FeedbackStatus, readonly FeedbackStatus[]>> = {
	new: ['in-progress'],
	'in-progress': ['new', 'in-review'],
	'in-review': ['in-progress', 'completed'],
	completed: ['archived', 'in-review'],
	archived: ['new'],
};

// ── Journal entry types ────────────────────────────────────────────

/**
 * All activity on a feedback item is logged to an append-only journal.
 * Enables work recovery and audit trails.
 */
export const JOURNAL_TYPES: Readonly<Record<string, JournalType>> = {
	CLAIMED: 'claimed',
	HEARTBEAT: 'heartbeat',
	NOTE: 'note',
	SUBTASK: 'subtask',
	STATUS_CHANGE: 'status_change',
	FILE_TOUCHED: 'file_touched',
	UNCLAIMED: 'unclaimed',
	CLAIM_REQUESTED: 'claim_requested',
	CLAIM_STOLEN: 'claim_stolen',
};

// ── Swim lane config ───────────────────────────────────────────────

export interface SwimLaneDisplayConfig {
	id: SwimLane;
	label: string;
	color: string;
	icon: string;
	collapsed: boolean;
}

export const SWIM_LANE_CONFIG: Readonly<Record<SwimLane, SwimLaneDisplayConfig>> = {
	critical: {
		id: 'critical',
		label: 'Critical',
		color: '#ef4444',
		icon: 'fa-fire',
		collapsed: false,
	},
	normal: {
		id: 'normal',
		label: 'Normal',
		color: '#3b82f6',
		icon: 'fa-circle',
		collapsed: false,
	},
	internal: {
		id: 'internal',
		label: 'Internal',
		color: '#6b7280',
		icon: 'fa-code',
		collapsed: true,
	},
	backlog: {
		id: 'backlog',
		label: 'Backlog',
		color: '#94a3b8',
		icon: 'fa-clock',
		collapsed: true,
	},
};
