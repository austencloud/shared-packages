// ── Repository adapter ─────────────────────────────────────────────
export type {
	IFeedbackRepository,
	IVersionRepository,
	FeedbackFilter,
	PaginatedResult,
} from './repository.js';

// ── Claim deriver ──────────────────────────────────────────────────
export {
	deriveEffectiveStatus,
	hasActiveClaim,
	isClaimStale,
	countActiveClaims,
	getClaimStalenessInfo,
} from './claim-deriver.js';

// ── Status machine ─────────────────────────────────────────────────
export {
	validateTransition,
	executeTransition,
	isValidTransition,
	getValidNextStatuses,
} from './status-machine.js';

export type { TransitionResult } from './status-machine.js';

// ── Sorter ─────────────────────────────────────────────────────────
export {
	sortByPriority,
	groupByStatus,
	getDeferredItems,
	getExpiredDeferrals,
} from './sorter.js';

// ── Swim lanes ─────────────────────────────────────────────────────
export { deriveLane, groupByLane } from './swim-lane.js';

// ── Submitter ──────────────────────────────────────────────────────
export {
	submitFeedback,
	validateSubmission,
} from './submitter.js';

export type {
	SubmitFeedbackInput,
	SubmitResult,
	ValidationError,
} from './submitter.js';

// ── Release manager ────────────────────────────────────────────────
export {
	prepareRelease,
	archiveItem,
	generateChangelogEntries,
	summarizeFeedback,
} from './release-manager.js';

export type {
	PrepareReleaseInput,
	PrepareReleaseResult,
	ArchiveInput,
} from './release-manager.js';

// ── Notification builder ───────────────────────────────────────────
export {
	buildStatusChangeNotification,
	buildAdminResponseNotification,
	buildReleaseNotification,
} from './notification-builder.js';

export type {
	FeedbackNotificationType,
	FeedbackNotificationPayload,
} from './notification-builder.js';
