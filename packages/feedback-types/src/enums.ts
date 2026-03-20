/**
 * Feedback system enums and literal union types.
 *
 * These are the canonical type definitions shared across all AustenCloud apps,
 * the feedback CLI, and any other tooling that touches the feedback system.
 */

// ── Core domain enums ──────────────────────────────────────────────

export type FeedbackType = 'bug' | 'feature' | 'general';

export type FeedbackStatus = 'new' | 'in-progress' | 'in-review' | 'completed' | 'archived';

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export type ArchiveReason =
	| 'released'
	| 'declined'
	| 'duplicate'
	| 'wont-fix'
	| 'deferred'
	| 'invalid';

// ── Claim system ───────────────────────────────────────────────────

export type ClaimHealth = 'none' | 'active' | 'stale' | 'orphaned';

export type StaleReason = 'no-claim-time' | 'exceeded-max-time' | 'no-activity';

export type AgentType = 'claude-cli' | 'human' | 'ci';

// ── Journal / audit trail ──────────────────────────────────────────

export type JournalType =
	| 'claimed'
	| 'heartbeat'
	| 'note'
	| 'subtask'
	| 'status_change'
	| 'file_touched'
	| 'unclaimed'
	| 'claim_requested'
	| 'claim_stolen';

// ── Swim lanes (kanban) ───────────────────────────────────────────

export type SwimLane = 'critical' | 'normal' | 'internal' | 'backlog';

// ── Source tracking ────────────────────────────────────────────────

export type FeedbackSource = 'app' | 'terminal';

// ── Tester confirmation ────────────────────────────────────────────

export type TesterConfirmationStatus = 'pending' | 'confirmed' | 'needs-work' | 'no-response';

// ── Changelog ──────────────────────────────────────────────────────

export type ChangelogCategory = 'fixed' | 'added' | 'improved';

// ── Ordered arrays (useful for iteration / UI) ─────────────────────

export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
	'new',
	'in-progress',
	'in-review',
	'completed',
	'archived',
] as const;

export const FEEDBACK_PRIORITIES: readonly FeedbackPriority[] = [
	'low',
	'medium',
	'high',
	'critical',
] as const;

export const FEEDBACK_TYPES: readonly FeedbackType[] = ['bug', 'feature', 'general'] as const;

export const ARCHIVE_REASONS: readonly ArchiveReason[] = [
	'released',
	'declined',
	'duplicate',
	'wont-fix',
	'deferred',
	'invalid',
] as const;

export const SWIM_LANE_ORDER: readonly SwimLane[] = [
	'critical',
	'normal',
	'internal',
	'backlog',
] as const;

/**
 * Priority sort order. Empty string = no priority set (triaged first).
 */
export const PRIORITY_ORDER: readonly string[] = ['', 'high', 'medium', 'low'] as const;
