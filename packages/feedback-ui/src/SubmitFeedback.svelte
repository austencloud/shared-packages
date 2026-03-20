<script lang="ts">
	import type { FeedbackType, FeedbackPriority, FeedbackFormData } from '@austencloud/feedback-types';
	import type { SubmitFeedbackProps } from './types.js';
	import TypeSelector from './submit/TypeSelector.svelte';
	import PriorityPills from './submit/PriorityPills.svelte';
	import SubmitButton from './submit/SubmitButton.svelte';

	const {
		user,
		onSubmit,
		defaultType = 'general',
		defaultPriority,
		successMessage = 'Thank you for your feedback!',
		extraFieldsSnippet,
	}: SubmitFeedbackProps = $props();

	let type = $state<FeedbackType>(defaultType);
	let title = $state('');
	let description = $state('');
	let priority = $state<FeedbackPriority | undefined>(defaultPriority);
	let isSubmitting = $state(false);
	let submitStatus = $state<'idle' | 'success' | 'error'>('idle');
	let errorMessage = $state('');

	const isValid = $derived(description.trim().length >= 10);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!isValid || isSubmitting) return;

		isSubmitting = true;
		errorMessage = '';

		try {
			const formData: FeedbackFormData = {
				type,
				title: title.trim() || description.trim().slice(0, 60),
				description: description.trim(),
				priority,
			};
			await onSubmit(formData);
			submitStatus = 'success';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Submission failed';
			submitStatus = 'error';
		} finally {
			isSubmitting = false;
		}
	}

	function reset() {
		type = defaultType;
		title = '';
		description = '';
		priority = defaultPriority;
		submitStatus = 'idle';
		errorMessage = '';
	}
</script>

<div class="submit-feedback" style:container-type="inline-size" style:container-name="submit-form">
	{#if submitStatus === 'success'}
		<div class="success-state">
			<div class="success-icon" aria-hidden="true">&#10003;</div>
			<p class="success-message">{successMessage}</p>
			<button class="submit-another-btn" onclick={reset}>
				Submit Another
			</button>
		</div>
	{:else}
		<form onsubmit={handleSubmit}>
			<div class="form-section">
				<label class="section-label">Type</label>
				<TypeSelector selectedType={type} onTypeChange={(t) => (type = t)} />
			</div>

			<div class="form-section">
				<label class="section-label" for="fb-title">Title <span class="optional">(optional)</span></label>
				<input
					id="fb-title"
					class="text-input"
					type="text"
					placeholder="Brief summary..."
					bind:value={title}
					maxlength="100"
				/>
			</div>

			<div class="form-section">
				<label class="section-label" for="fb-description">
					Description
					<span class="char-hint" class:warn={description.length > 0 && description.length < 10}>
						{description.length < 10 ? `${10 - description.length} more chars needed` : ''}
					</span>
				</label>
				<textarea
					id="fb-description"
					class="text-input textarea"
					placeholder="Describe in detail..."
					bind:value={description}
					rows="4"
				></textarea>
			</div>

			<div class="form-section">
				<label class="section-label">Priority</label>
				<PriorityPills selectedPriority={priority} onPriorityChange={(p) => (priority = p)} />
			</div>

			{#if extraFieldsSnippet}
				<div class="form-section">
					{@render extraFieldsSnippet()}
				</div>
			{/if}

			{#if errorMessage}
				<div class="error-banner" role="alert">{errorMessage}</div>
			{/if}

			<SubmitButton {isSubmitting} disabled={!isValid} />
		</form>
	{/if}
</div>

<style>
	.submit-feedback {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-md, 16px);
		padding: var(--fb-space-md, 16px);
		flex: 1;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-2xs, 6px);
	}

	.section-label {
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.optional {
		font-weight: 400;
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	.char-hint {
		font-weight: 400;
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		margin-left: auto;
	}

	.char-hint.warn {
		color: var(--semantic-warning, #f59e0b);
	}

	.text-input {
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-size: var(--fb-text-base, 1rem);
		font-family: inherit;
		transition: border-color var(--fb-duration-fast, 0.15s), box-shadow var(--fb-duration-fast, 0.15s);
	}

	.text-input:focus {
		outline: none;
		border-color: var(--fb-status-new, #3b82f6);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--fb-status-new, #3b82f6) 15%, transparent);
	}

	.textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.5;
	}

	.error-banner {
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-sm, 8px);
		background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
		color: var(--semantic-error, #ef4444);
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 500;
		border-left: 3px solid var(--semantic-error, #ef4444);
	}

	/* ── Success state ─────────────────────────────────────── */
	.success-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--fb-space-md, 16px);
		padding: var(--fb-space-lg, 32px);
		text-align: center;
		flex: 1;
		animation: fadeIn var(--fb-duration-normal, 0.3s) var(--fb-spring-bounce, ease);
	}

	.success-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--semantic-success, #10b981) 15%, transparent);
		color: var(--semantic-success, #10b981);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: 700;
		box-shadow: 0 0 20px color-mix(in srgb, var(--semantic-success, #10b981) 20%, transparent);
	}

	.success-message {
		font-size: var(--fb-text-lg, 1.125rem);
		font-weight: 600;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
	}

	.submit-another-btn {
		padding: var(--fb-space-xs, 8px) var(--fb-space-md, 16px);
		border-radius: var(--fb-radius-md, 12px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		cursor: pointer;
	}

	.submit-another-btn:hover {
		background: var(--theme-card-hover-bg, rgba(40, 40, 52, 0.95));
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.success-state {
			animation: none;
		}
		.text-input {
			transition: none;
		}
	}
</style>
