/**
 * Repository adapter interface.
 *
 * Consumers implement this interface to connect the feedback services
 * to their data layer (Firestore, REST API, in-memory, etc.).
 *
 * The services package never imports Firebase or any database SDK.
 */

import type {
	FeedbackItem,
	FeedbackStatus,
	FeedbackType,
	FeedbackPriority,
} from '@austencloud/feedback-types';

// ── Filter ─────────────────────────────────────────────────────────

export interface FeedbackFilter {
	statuses?: FeedbackStatus[];
	types?: FeedbackType[];
	priorities?: FeedbackPriority[];
	userId?: string;
	excludeDeleted?: boolean;
	excludeArchived?: boolean;
	orderBy?: 'createdAt' | 'updatedAt' | 'priority';
	orderDirection?: 'asc' | 'desc';
	limit?: number;
	afterId?: string;
}

// ── Paginated result ───────────────────────────────────────────────

export interface PaginatedResult<T> {
	items: T[];
	lastDocId?: string;
	hasMore: boolean;
}

// ── Repository interface ───────────────────────────────────────────

export interface IFeedbackRepository {
	// Read
	getById(id: string): Promise<FeedbackItem | null>;
	getAll(filter?: FeedbackFilter): Promise<FeedbackItem[]>;
	getByUser(userId: string, filter?: FeedbackFilter): Promise<FeedbackItem[]>;
	getByStatus(statuses: FeedbackStatus[]): Promise<FeedbackItem[]>;

	// Write
	create(item: Omit<FeedbackItem, 'id'>): Promise<string>;
	update(id: string, changes: Partial<FeedbackItem>): Promise<void>;
	delete(id: string): Promise<void>;

	// Real-time (optional — not all consumers need it)
	subscribe?(
		filter: FeedbackFilter,
		callback: (items: FeedbackItem[]) => void,
		onError?: (error: Error) => void
	): () => void;
}

// ── Version repository (optional) ──────────────────────────────────

export interface IVersionRepository {
	getAll(): Promise<import('@austencloud/feedback-types').AppVersion[]>;
	getLatest(): Promise<string | null>;
	create(version: import('@austencloud/feedback-types').AppVersion): Promise<void>;
	update(
		version: string,
		changes: Partial<import('@austencloud/feedback-types').AppVersion>
	): Promise<void>;
}
