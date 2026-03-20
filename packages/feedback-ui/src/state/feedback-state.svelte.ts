/**
 * Reactive feedback state factory.
 *
 * Creates a rune-based reactive store from a repository adapter.
 * Components receive this state as props — no global singletons.
 *
 * Usage:
 *   const repo = createFirestoreRepository();
 *   const state = createFeedbackState(repo);
 *   $effect(() => state.subscribe());
 */

import type { FeedbackItem, FeedbackStatus } from '@austencloud/feedback-types';
import type { IFeedbackRepository, FeedbackFilter } from '@austencloud/feedback-services';

export interface FeedbackState {
	readonly items: FeedbackItem[];
	readonly loading: boolean;
	readonly error: string | null;
	subscribe(filter?: FeedbackFilter): () => void;
	refresh(filter?: FeedbackFilter): Promise<void>;
	getByStatus(status: FeedbackStatus): FeedbackItem[];
	getById(id: string): FeedbackItem | undefined;
}

export function createFeedbackState(repo: IFeedbackRepository): FeedbackState {
	let items = $state<FeedbackItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	return {
		get items() {
			return items;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},

		subscribe(filter?: FeedbackFilter): () => void {
			loading = true;
			error = null;

			if (repo.subscribe) {
				return repo.subscribe(
					filter ?? {},
					(newItems) => {
						items = newItems;
						loading = false;
					},
					(err) => {
						error = err.message;
						loading = false;
					}
				);
			}

			// Fallback: one-time load
			this.refresh(filter);
			return () => {};
		},

		async refresh(filter?: FeedbackFilter): Promise<void> {
			loading = true;
			error = null;
			try {
				items = await repo.getAll(filter);
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load feedback';
			} finally {
				loading = false;
			}
		},

		getByStatus(status: FeedbackStatus): FeedbackItem[] {
			return items.filter((i) => i.status === status);
		},

		getById(id: string): FeedbackItem | undefined {
			return items.find((i) => i.id === id);
		},
	};
}
