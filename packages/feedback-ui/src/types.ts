/**
 * Component prop interfaces for feedback UI.
 */

import type {
	FeedbackItem,
	FeedbackType,
	FeedbackPriority,
	FeedbackStatus,
	FeedbackFormData,
	FeedbackUser,
	ArchiveReason,
} from '@austencloud/feedback-types';
import type { Snippet } from 'svelte';

// ── SubmitFeedback ─────────────────────────────────────────────────

export interface SubmitFeedbackProps {
	user: FeedbackUser;
	onSubmit: (data: FeedbackFormData) => Promise<void>;
	capturedRoute?: string;
	defaultType?: FeedbackType;
	defaultPriority?: FeedbackPriority;
	successMessage?: string;
	/** Snippet for extra fields after description (e.g., image upload) */
	extraFieldsSnippet?: Snippet;
}

// ── MyFeedback ─────────────────────────────────────────────────────

export interface MyFeedbackProps {
	items: FeedbackItem[];
	loading: boolean;
	isAuthenticated: boolean;
	onItemClick?: (item: FeedbackItem) => void;
	emptyMessage?: string;
	signInMessage?: string;
}

// ── KanbanBoard ────────────────────────────────────────────────────

export interface KanbanBoardProps {
	items: FeedbackItem[];
	loading: boolean;
	onStatusChange: (itemId: string, newStatus: FeedbackStatus) => Promise<void>;
	onArchive?: (itemId: string, reason: ArchiveReason, notes?: string) => Promise<void>;
	onDefer?: (itemId: string, until: Date, notes: string) => Promise<void>;
	onItemClick?: (item: FeedbackItem) => void;
	columns?: FeedbackStatus[];
	/** Custom card content via Svelte 5 snippet */
	cardSnippet?: Snippet<[FeedbackItem]>;
	showWipWarnings?: boolean;
	showClaimIndicators?: boolean;
	enableDragDrop?: boolean;
	mobileBreakpoint?: number;
}

// ── FeedbackDetail ─────────────────────────────────────────────────

export interface FeedbackDetailProps {
	item: FeedbackItem;
	onClose: () => void;
	onStatusChange?: (itemId: string, newStatus: FeedbackStatus) => Promise<void>;
	onUpdate?: (itemId: string, changes: Partial<FeedbackItem>) => Promise<void>;
	onArchive?: (itemId: string, reason: ArchiveReason, notes?: string) => Promise<void>;
	readOnly?: boolean;
}

// ── Internal ───────────────────────────────────────────────────────

export interface KanbanColumnConfig {
	status: FeedbackStatus;
	label: string;
	color: string;
	icon: string;
}

export type KanbanStatus = 'new' | 'in-progress' | 'in-review' | 'completed';
