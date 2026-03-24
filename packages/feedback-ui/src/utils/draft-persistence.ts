export interface FeedbackDraft {
	type: string;
	title: string;
	description: string;
	priority?: string;
}

const DEFAULT_KEY = 'feedback-form-draft';

export function saveDraft(draft: FeedbackDraft, key = DEFAULT_KEY): void {
	try {
		localStorage.setItem(key, JSON.stringify(draft));
	} catch {
		// localStorage full or unavailable -- silently ignore
	}
}

export function loadDraft(key = DEFAULT_KEY): FeedbackDraft | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as FeedbackDraft;
	} catch {
		return null;
	}
}

export function clearDraft(key = DEFAULT_KEY): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// silently ignore
	}
}
