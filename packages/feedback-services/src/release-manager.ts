/**
 * Release manager.
 *
 * Handles the "prepare release" workflow:
 *   1. Gather all completed feedback items
 *   2. Generate changelog entries
 *   3. Archive items with fixedInVersion
 *   4. Create version record
 */

import type {
	FeedbackItem,
	AppVersion,
	ChangelogEntry,
	FeedbackSummary,
	ArchiveReason,
} from '@austencloud/feedback-types';
import type { IFeedbackRepository, IVersionRepository } from './repository.js';

// ── Changelog generation ───────────────────────────────────────────

/**
 * Auto-generate changelog entries from completed feedback items.
 * Maps feedback type to changelog category:
 *   bug → fixed, feature → added, general → improved
 */
export function generateChangelogEntries(items: FeedbackItem[]): ChangelogEntry[] {
	return items.map((item) => ({
		category: item.type === 'bug' ? 'fixed' : item.type === 'feature' ? 'added' : 'improved',
		text: item.changelogEntry ?? item.title,
		feedbackId: item.id,
	}));
}

/**
 * Summarize feedback items by type.
 */
export function summarizeFeedback(items: FeedbackItem[]): FeedbackSummary {
	return {
		bugs: items.filter((i) => i.type === 'bug').length,
		features: items.filter((i) => i.type === 'feature').length,
		general: items.filter((i) => i.type === 'general').length,
	};
}

// ── Prepare release ────────────────────────────────────────────────

export interface PrepareReleaseInput {
	version: string;
	changelogEntries?: ChangelogEntry[];
	releaseNotes?: string;
}

export interface PrepareReleaseResult {
	success: boolean;
	error?: string;
	archivedCount: number;
	version?: AppVersion;
}

/**
 * Prepare a release: archive completed items and create a version record.
 */
export async function prepareRelease(
	feedbackRepo: IFeedbackRepository,
	versionRepo: IVersionRepository,
	input: PrepareReleaseInput
): Promise<PrepareReleaseResult> {
	if (!input.version.trim()) {
		return { success: false, error: 'Version string is required', archivedCount: 0 };
	}

	// Get all completed items
	const completedItems = await feedbackRepo.getByStatus(['completed']);
	if (completedItems.length === 0) {
		return { success: false, error: 'No completed items to release', archivedCount: 0 };
	}

	// Generate changelog if not provided
	const entries = input.changelogEntries ?? generateChangelogEntries(completedItems);
	const summary = summarizeFeedback(completedItems);

	// Archive each completed item
	const now = new Date();
	for (const item of completedItems) {
		await feedbackRepo.update(item.id, {
			status: 'archived',
			archiveReason: 'released' as ArchiveReason,
			fixedInVersion: input.version,
			archivedAt: now,
			updatedAt: now,
		});
	}

	// Create version record
	const appVersion: AppVersion = {
		version: input.version,
		releasedAt: now,
		releaseNotes: input.releaseNotes,
		feedbackCount: completedItems.length,
		feedbackSummary: summary,
		changelogEntries: entries,
	};

	await versionRepo.create(appVersion);

	return {
		success: true,
		archivedCount: completedItems.length,
		version: appVersion,
	};
}

// ── Archive individual items ───────────────────────────────────────

export interface ArchiveInput {
	itemId: string;
	reason: ArchiveReason;
	notes?: string;
	archivedBy: string;
}

/**
 * Archive a single feedback item with a reason.
 */
export async function archiveItem(
	repo: IFeedbackRepository,
	input: ArchiveInput
): Promise<{ success: boolean; error?: string }> {
	const item = await repo.getById(input.itemId);
	if (!item) {
		return { success: false, error: `Item "${input.itemId}" not found` };
	}

	await repo.update(input.itemId, {
		status: 'archived',
		archiveReason: input.reason,
		archivedAt: new Date(),
		adminNotes: input.notes
			? (item.adminNotes ? `${item.adminNotes}\n${input.notes}` : input.notes)
			: item.adminNotes,
		updatedAt: new Date(),
	});

	return { success: true };
}
