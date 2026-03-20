// ── Enums & literal types ──────────────────────────────────────────
export type {
	FeedbackType,
	FeedbackStatus,
	FeedbackPriority,
	ArchiveReason,
	ClaimHealth,
	StaleReason,
	AgentType,
	JournalType,
	SwimLane,
	FeedbackSource,
	TesterConfirmationStatus,
	ChangelogCategory,
} from './enums.js';

export {
	FEEDBACK_STATUSES,
	FEEDBACK_PRIORITIES,
	FEEDBACK_TYPES,
	ARCHIVE_REASONS,
	SWIM_LANE_ORDER,
	PRIORITY_ORDER,
} from './enums.js';

// ── Domain models ──────────────────────────────────────────────────
export type {
	FeedbackItem,
	FeedbackSubtask,
	FeedbackResponse,
	AdminResponse,
	TesterConfirmation,
	StatusHistoryEntry,
	JournalEntry,
	DeviceContext,
	AppVersion,
	FeedbackSummary,
	ChangelogEntry,
	EffectiveStatus,
	FeedbackFormData,
	FeedbackUser,
} from './models.js';

// ── Configuration constants ────────────────────────────────────────
export {
	STALE_THRESHOLDS,
	AGENT_SESSION_CONFIG,
	EMERGENCY_CONFIG,
	WIP_LIMITS,
	VALID_TRANSITIONS,
	JOURNAL_TYPES,
	SWIM_LANE_CONFIG,
} from './config.js';

export type { SwimLaneDisplayConfig } from './config.js';

// ── Display config ─────────────────────────────────────────────────
export {
	STATUS_DISPLAY,
	TYPE_DISPLAY,
	PRIORITY_DISPLAY,
	ARCHIVE_REASON_DISPLAY,
} from './display-config.js';

export type { DisplayConfig } from './display-config.js';

// ── Guards & utilities ─────────────────────────────────────────────
export {
	isFeedbackStatus,
	isFeedbackType,
	isFeedbackPriority,
	isArchiveReason,
	isValidTransition,
	getValidNextStatuses,
	checkClaimStaleness,
	isApproachingStale,
	getClaimHealth,
	formatDuration,
} from './guards.js';

export type { StalenessResult } from './guards.js';
