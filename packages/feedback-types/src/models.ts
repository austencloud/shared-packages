/**
 * Feedback system domain models.
 *
 * FeedbackItem is the canonical shape stored in Firestore.
 * Both Cirque Aflame and TKA Platform use this exact interface.
 * Fields marked as optional are used by one or both apps as needed.
 */

import type {
	FeedbackType,
	FeedbackStatus,
	FeedbackPriority,
	FeedbackSource,
	ArchiveReason,
	JournalType,
	TesterConfirmationStatus,
	ChangelogCategory,
	ClaimHealth,
} from './enums.js';

// ── Core entity ────────────────────────────────────────────────────

export interface FeedbackItem {
	id: string;

	// User info (flattened for Firestore denormalization)
	userId: string;
	userEmail: string;
	userDisplayName: string;
	userPhotoURL?: string;

	// Core content
	type: FeedbackType;
	title: string;
	description: string;
	status: FeedbackStatus;
	priority?: FeedbackPriority;

	// Context capture
	capturedRoute?: string;
	capturedModule?: string;
	capturedTab?: string;
	deviceContext?: DeviceContext;
	source?: FeedbackSource;

	// Claim system
	claimedBy?: string;
	claimedAt?: Date;
	claimToken?: string;
	claimSession?: string;
	lastActivity?: Date;
	lastActivityType?: string;

	// Admin management
	adminNotes?: string;
	resolutionNotes?: string;
	userFacingNotes?: string;
	changelogEntry?: string;
	fixedInVersion?: string;
	internalOnly?: boolean;

	// Archive / defer
	archiveReason?: ArchiveReason;
	archivedAt?: Date;
	deferredUntil?: Date;
	reactivatedAt?: Date;
	reactivatedFrom?: Date;

	// Rich content
	imageUrls?: string[];
	originalTitle?: string;
	originalDescription?: string;

	// Relationships
	subtasks?: FeedbackSubtask[];

	// Admin/tester workflow
	adminResponse?: AdminResponse;
	testerConfirmation?: TesterConfirmation;

	// Audit trail
	statusHistory?: StatusHistoryEntry[];
	journal?: JournalEntry[];

	// Notification tracking
	lastNotifiedAt?: Date;
	lastNotifiedStatus?: FeedbackStatus;

	// Soft delete
	isDeleted?: boolean;
	deletedAt?: Date;
	deletedBy?: string;

	// Timestamps
	createdAt: Date;
	updatedAt?: Date;
}

// ── Supporting models ──────────────────────────────────────────────

export interface FeedbackSubtask {
	id: string;
	title: string;
	description?: string;
	completed: boolean;
	dependsOn?: string[];
	createdAt: Date;
	completedAt?: Date;
}

export interface FeedbackResponse {
	id: string;
	feedbackId: string;
	userId: string;
	userDisplayName: string;
	message: string;
	createdAt: Date;
}

export interface AdminResponse {
	message: string;
	respondedAt: Date;
	respondedBy: string;
}

export interface TesterConfirmation {
	status: TesterConfirmationStatus;
	comment?: string;
	respondedAt: Date;
}

export interface StatusHistoryEntry {
	fromStatus: FeedbackStatus;
	toStatus: FeedbackStatus;
	changedBy: string;
	changedAt: Date;
	notes?: string;
}

export interface JournalEntry {
	type: JournalType;
	timestamp: Date;
	agentId?: string;
	sessionId?: string;
	message?: string;
	metadata?: Record<string, unknown>;
}

export interface DeviceContext {
	userAgent?: string;
	platform?: string;
	isTouchDevice?: boolean;
	viewport?: { width: number; height: number };
	screen?: { width: number; height: number };
	devicePixelRatio?: number;
	appVersion?: string;
}

// ── Version / release ──────────────────────────────────────────────

export interface AppVersion {
	version: string;
	releasedAt: Date;
	releaseNotes?: string;
	feedbackCount: number;
	feedbackSummary: FeedbackSummary;
	changelogEntries?: ChangelogEntry[];
	highlights?: string[];
}

export interface FeedbackSummary {
	bugs: number;
	features: number;
	general: number;
}

export interface ChangelogEntry {
	category: ChangelogCategory;
	text: string;
	feedbackId?: string;
}

// ── Derived status (used by claim deriver) ─────────────────────────

export interface EffectiveStatus {
	displayStatus: FeedbackStatus;
	storedStatus: FeedbackStatus;
	claimHealth: ClaimHealth;
	claimAgeMs?: number;
	claimTokenShort?: string;
}

// ── Form data (used by submit components) ──────────────────────────

export interface FeedbackFormData {
	type: FeedbackType;
	title: string;
	description: string;
	priority?: FeedbackPriority;
}

export interface FeedbackUser {
	userId: string;
	email: string;
	displayName: string;
	photoURL?: string;
}
