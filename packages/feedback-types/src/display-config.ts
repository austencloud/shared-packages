/**
 * Display configuration for feedback UI.
 *
 * Labels, colors, and icons for each enum value.
 * UI components use these instead of hardcoding display logic.
 */

import type { FeedbackStatus, FeedbackType, FeedbackPriority, ArchiveReason } from './enums.js';

// ── Display config shape ───────────────────────────────────────────

export interface DisplayConfig {
	label: string;
	color: string;
	icon: string;
}

// ── Status display ─────────────────────────────────────────────────

export const STATUS_DISPLAY: Readonly<Record<FeedbackStatus, DisplayConfig>> = {
	new: { label: 'New', color: '#3b82f6', icon: 'circle-plus' },
	'in-progress': { label: 'In Progress', color: '#f59e0b', icon: 'loader' },
	'in-review': { label: 'In Review', color: '#8b5cf6', icon: 'eye' },
	completed: { label: 'Completed', color: '#10b981', icon: 'circle-check' },
	archived: { label: 'Archived', color: '#6b7280', icon: 'archive' },
};

// ── Type display ───────────────────────────────────────────────────

export const TYPE_DISPLAY: Readonly<Record<FeedbackType, DisplayConfig>> = {
	bug: { label: 'Bug', color: '#ef4444', icon: 'bug' },
	feature: { label: 'Feature', color: '#f59e0b', icon: 'lightbulb' },
	general: { label: 'General', color: '#3b82f6', icon: 'message-circle' },
};

// ── Priority display ───────────────────────────────────────────────

export const PRIORITY_DISPLAY: Readonly<Record<FeedbackPriority, DisplayConfig>> = {
	low: { label: 'Low', color: '#6b7280', icon: 'arrow-down' },
	medium: { label: 'Medium', color: '#3b82f6', icon: 'minus' },
	high: { label: 'High', color: '#f59e0b', icon: 'arrow-up' },
	critical: { label: 'Critical', color: '#ef4444', icon: 'alert-triangle' },
};

// ── Archive reason display ─────────────────────────────────────────

export const ARCHIVE_REASON_DISPLAY: Readonly<Record<ArchiveReason, DisplayConfig>> = {
	released: { label: 'Released', color: '#10b981', icon: 'rocket' },
	declined: { label: 'Declined', color: '#6b7280', icon: 'x-circle' },
	duplicate: { label: 'Duplicate', color: '#8b5cf6', icon: 'copy' },
	'wont-fix': { label: "Won't Fix", color: '#6b7280', icon: 'ban' },
	deferred: { label: 'Deferred', color: '#f59e0b', icon: 'clock' },
	invalid: { label: 'Invalid', color: '#ef4444', icon: 'alert-circle' },
};
