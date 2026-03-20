/**
 * Feedback submission service.
 *
 * Validates input and creates feedback items via the repository adapter.
 * Consumer is responsible for auth and image upload — this handles
 * only the core creation logic.
 */

import type {
	FeedbackItem,
	FeedbackFormData,
	FeedbackUser,
} from '@austencloud/feedback-types';
import type { IFeedbackRepository } from './repository.js';

// ── Input types ────────────────────────────────────────────────────

export interface SubmitFeedbackInput {
	user: FeedbackUser;
	form: FeedbackFormData;
	capturedRoute?: string;
	capturedModule?: string;
	capturedTab?: string;
	imageUrls?: string[];
	source?: 'app' | 'terminal';
}

// ── Validation ─────────────────────────────────────────────────────

export interface ValidationError {
	field: string;
	message: string;
}

export function validateSubmission(input: SubmitFeedbackInput): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!input.user.userId) {
		errors.push({ field: 'userId', message: 'User ID is required' });
	}

	if (!input.form.title.trim()) {
		errors.push({ field: 'title', message: 'Title is required' });
	}

	if (!input.form.description.trim()) {
		errors.push({ field: 'description', message: 'Description is required' });
	} else if (input.form.description.trim().length < 10) {
		errors.push({ field: 'description', message: 'Description must be at least 10 characters' });
	}

	return errors;
}

// ── Submit ─────────────────────────────────────────────────────────

export interface SubmitResult {
	success: boolean;
	id?: string;
	errors?: ValidationError[];
}

/**
 * Validate and submit a feedback item.
 */
export async function submitFeedback(
	repo: IFeedbackRepository,
	input: SubmitFeedbackInput
): Promise<SubmitResult> {
	const errors = validateSubmission(input);
	if (errors.length > 0) {
		return { success: false, errors };
	}

	const item: Omit<FeedbackItem, 'id'> = {
		userId: input.user.userId,
		userEmail: input.user.email,
		userDisplayName: input.user.displayName,
		userPhotoURL: input.user.photoURL,
		type: input.form.type,
		title: input.form.title.trim(),
		description: input.form.description.trim(),
		status: 'new',
		priority: input.form.priority,
		capturedRoute: input.capturedRoute,
		capturedModule: input.capturedModule,
		capturedTab: input.capturedTab,
		imageUrls: input.imageUrls,
		source: input.source,
		createdAt: new Date(),
	};

	const id = await repo.create(item);
	return { success: true, id };
}
