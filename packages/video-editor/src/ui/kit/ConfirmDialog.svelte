<!--
  ConfirmDialog.svelte

  A confirmation dialog with glassmorphism styling.
  A fixed backdrop plus panel, both moved onto the body so no transformed ancestor offsets them.
  The panel is a modal dialog: Tab stays inside it (FocusTrap), Escape cancels through the
  editor's escape layer stack, and a press on the backdrop cancels.
-->
<script lang="ts">
	import { useStrings } from "../../strings/context.js";
	import { useEditorServices } from "../editor-context.js";
	import { DEFAULT_INERT_EXCLUSIONS, FocusTrap } from "./drawer/focus-trap.js";
	import Icon from "./Icon.svelte";
	import { faCheck, faCircleInfo, faTrash, faTriangleExclamation } from "./icons.js";

	const t = useStrings();
	const services = useEditorServices();

	let {
		isOpen = $bindable(false),
		title,
		message,
		confirmText,
		cancelText,
		onConfirm,
		onCancel,
		variant = "warning",
		showDontAskAgain = false,
		onDontAskAgainChange,
		confirmDelay = 0,
		ghostConfirm = false,
	} = $props<{
		isOpen?: boolean;
		title: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm: () => void;
		onCancel: () => void;
		variant?: "warning" | "danger" | "info";
		showDontAskAgain?: boolean;
		onDontAskAgainChange?: (checked: boolean) => void;
		/** Delay in seconds before confirm button becomes clickable. Default: 0 (no delay) */
		confirmDelay?: number;
		/**
		 * Let the presentation-mode ghost go through with this dialog
		 * (`.claude/rules` -> attract annotations; default-deny, so it is opt-in per
		 * call site). Only for confirmations that are safe to demonstrate and
		 * undoable - clearing a sequence, applying a LOOP. NEVER for anything that
		 * deletes saved work, spends money, or touches an account: an unattended
		 * laptop at a jam must not be able to confirm those.
		 *
		 * Without this, a dialog the ghost raises and cannot dismiss is the worst
		 * state in the system - the backdrop fails every other control's hit-test,
		 * so the whole intention bag goes quiet until a human intervenes.
		 */
		ghostConfirm?: boolean;
	}>();

	let dontAskAgainChecked = $state(false);
	let delayRemaining = $state(0);
	let delayTimer: ReturnType<typeof setInterval> | null = null;

	// Start countdown when dialog opens with a delay
	$effect(() => {
		if (isOpen && confirmDelay > 0) {
			delayRemaining = confirmDelay;
			delayTimer = setInterval(() => {
				delayRemaining--;
				if (delayRemaining <= 0 && delayTimer) {
					clearInterval(delayTimer);
					delayTimer = null;
				}
			}, 1000);
		} else if (!isOpen) {
			// Reset when dialog closes
			if (delayTimer) {
				clearInterval(delayTimer);
				delayTimer = null;
			}
			delayRemaining = 0;
		}

		return () => {
			if (delayTimer) {
				clearInterval(delayTimer);
				delayTimer = null;
			}
		};
	});

	const isConfirmDisabled = $derived(delayRemaining > 0);

	const labelBase = `ve-confirm-${Math.random().toString(36).slice(2)}`;
	const titleId = `${labelBase}-title`;
	const descriptionId = `${labelBase}-description`;

	let dialogElement = $state<HTMLDivElement | null>(null);

	// The backdrop is a sibling of the panel on the body and must keep receiving presses.
	const focusTrap = new FocusTrap({
		inertExclusions: [...DEFAULT_INERT_EXCLUSIONS, "dialog-backdrop"],
	});

	/** The backdrop and panel live on the body, as bits-ui's did, so no transformed ancestor offsets them. */
	function portal(node: HTMLElement) {
		document.body.append(node);
		return { destroy: () => node.remove() };
	}

	// While open: trap Tab inside the panel and let Escape cancel.
	$effect(() => {
		if (!isOpen || !dialogElement) return;
		focusTrap.activate(dialogElement);
		const offEscape = services.shortcuts.escapeLayer(titleId, handleCancel);
		return () => {
			offEscape();
			focusTrap.deactivate();
		};
	});

	// Handle confirm button
	function handleConfirm() {
		// Trigger appropriate haptic feedback based on variant
		if (variant === "danger") {
			services.haptics("warning");
		} else {
			services.haptics("success");
		}

		// Notify about "Don't ask again" if checked
		if (dontAskAgainChecked && onDontAskAgainChange) {
			onDontAskAgainChange(true);
		}

		onConfirm();
		isOpen = false;
	}

	// Handle cancel button
	function handleCancel() {
		// Trigger navigation haptic feedback for cancel
		services.haptics("selection");

		onCancel();
		isOpen = false;
	}
</script>

{#if isOpen}
	<div
		use:portal
		role="presentation"
		class="ve-portal dialog-backdrop"
		onclick={handleCancel}
	></div>
	<div
		use:portal
		bind:this={dialogElement}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		aria-describedby={descriptionId}
		class="ve-portal dialog-container {variant}"
	>
		<!-- Icon -->
		<div class="dialog-icon">
			{#if variant === "warning"}
				<Icon icon={faTriangleExclamation} class="icon warning-icon" />
			{:else if variant === "danger"}
				<Icon icon={faTrash} class="icon danger-icon" />
			{:else}
				<Icon icon={faCircleInfo} class="icon info-icon" />
			{/if}
		</div>

		<!-- Content -->
		<div class="dialog-content">
			<h2 id={titleId} class="dialog-title">{title}</h2>
			<p id={descriptionId} class="dialog-message">
				{message}
			</p>
		</div>

		<!-- Don't Ask Again Chip -->
		{#if showDontAskAgain}
			<div class="dont-ask-wrapper">
				<button
					type="button"
					class="dont-ask-chip"
					class:selected={dontAskAgainChecked}
					onclick={() => (dontAskAgainChecked = !dontAskAgainChecked)}
					aria-pressed={dontAskAgainChecked}
				>
					{#if dontAskAgainChecked}
						<Icon icon={faCheck} class="chip-icon" />
					{/if}
					<span>{t("common_dont_ask_again")}</span>
				</button>
			</div>
		{/if}

		<!-- Actions -->
		<div class="dialog-actions">
			<button class="dialog-button cancel-button" onclick={handleCancel}>
				{cancelText ?? t("common_cancel")}
			</button>
			<button
				class="dialog-button confirm-button"
				class:delayed={isConfirmDisabled}
				data-ghost={ghostConfirm && !isConfirmDisabled ? "safe" : undefined}
				data-ghost-kind={ghostConfirm && !isConfirmDisabled ? "confirm" : undefined}
				data-ghost-label={confirmText ?? t("common_continue")}
				onclick={handleConfirm}
				disabled={isConfirmDisabled}
			>
				{#if isConfirmDisabled}
					{confirmText ?? t("common_continue")} ({delayRemaining}s)
				{:else}
					{confirmText ?? t("common_continue")}
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	:global(.dialog-backdrop) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal, 600);
		padding: 20px;
	}

	:global(.dialog-container) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--ve-theme-panel-bg);
		border: 1px solid var(--ve-theme-stroke, var(--ve-theme-stroke));
		border-radius: 16px;
		padding: 32px;
		max-width: 480px;
		width: 100%;
		box-shadow: var(--ve-theme-shadow, 0 20px 60px rgba(0, 0, 0, 0.5));
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		z-index: calc(var(--z-modal, 600) + 1);
	}

	:global(.dialog-container.warning) {
		border-color: color-mix(in srgb, var(--ve-semantic-warning, #f59e0b) 30%, transparent);
	}

	:global(.dialog-container.danger) {
		border-color: color-mix(in srgb, var(--ve-semantic-error, #ef4444) 30%, transparent);
	}

	:global(.dialog-container.info) {
		border-color: color-mix(in srgb, var(--ve-semantic-info, #3b82f6) 30%, transparent);
	}

	.dialog-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;
	}

	.dialog-icon :global(.icon) {
		font-size: 2.5rem;
		line-height: 1;
	}

	.dialog-icon :global(.warning-icon) {
		color: var(--ve-semantic-warning, #f59e0b);
	}

	.dialog-icon :global(.danger-icon) {
		color: var(--ve-theme-text-dim, rgba(255, 255, 255, 0.6));
	}

	.dialog-icon :global(.info-icon) {
		color: var(--ve-semantic-info, #3b82f6);
	}

	.dialog-content {
		text-align: center;
		margin-bottom: 28px;
	}

	:global(.dialog-title) {
		margin: 0 0 12px 0;
		font-size: var(--ve-font-size-2xl);
		font-weight: 600;
		color: var(--text-color, #ffffff);
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			Roboto,
			sans-serif;
	}

	:global(.dialog-message) {
		margin: 0;
		font-size: var(--ve-font-size-base);
		line-height: 1.6;
		color: var(--ve-theme-text-dim, var(--ve-theme-text-dim));
	}

	.dont-ask-wrapper {
		display: flex;
		justify-content: center;
		margin-bottom: 20px;
	}

	.dont-ask-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 100px;
		border: 1.5px solid var(--ve-theme-stroke, rgba(255, 255, 255, 0.15));
		background: transparent;
		cursor: pointer;
		font-size: var(--ve-font-size-sm);
		font-weight: 500;
		color: var(--ve-theme-text-dim);
		transition: all var(--ve-duration-fast) ease;
		user-select: none;
	}

	.dont-ask-chip:hover {
		background: var(--ve-theme-card-bg, rgba(255, 255, 255, 0.04));
		border-color: var(--ve-theme-stroke-strong, rgba(255, 255, 255, 0.25));
	}

	.dont-ask-chip:active {
		transform: scale(0.97);
	}

	.dont-ask-chip.selected {
		background: color-mix(in srgb, var(--ve-theme-accent, #6366f1) 15%, transparent);
		border-color: var(--ve-theme-accent, #6366f1);
		color: var(--ve-theme-accent, #6366f1);
	}

	.dont-ask-chip.selected:hover {
		background: color-mix(in srgb, var(--ve-theme-accent, #6366f1) 22%, transparent);
	}

	.dont-ask-chip:focus-visible {
		outline: 2px solid var(--ve-theme-accent);
		outline-offset: 2px;
	}

	.dont-ask-chip :global(.chip-icon) {
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.dialog-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.dialog-button {
		padding: 12px 32px;
		border-radius: 8px;
		font-size: var(--ve-font-size-base);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-normal) ease;
		border: 2px solid transparent;
		min-width: 120px;
	}

	.cancel-button {
		background: var(--ve-theme-card-bg);
		color: var(--ve-theme-text, var(--ve-theme-text));
		border-color: var(--ve-theme-stroke);
	}

	.cancel-button:hover {
		background: var(--ve-theme-card-hover-bg);
		border-color: var(--ve-theme-stroke-strong);
		transform: translateY(-1px);
	}

	.confirm-button {
		background: linear-gradient(
			135deg,
			var(--ve-theme-accent) 0%,
			var(--ve-theme-accent-strong) 100%
		);
		color: white;
		border-color: var(--ve-theme-stroke);
	}

	.confirm-button:hover {
		background: linear-gradient(
			135deg,
			var(--ve-theme-accent-strong) 0%,
			var(--ve-theme-accent) 100%
		);
		border-color: var(--ve-theme-stroke-strong);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--ve-theme-accent) 40%, transparent);
	}

	:global(.dialog-container.warning) .confirm-button {
		background: linear-gradient(
			135deg,
			var(--ve-semantic-warning, #f59e0b) 0%,
			color-mix(in srgb, var(--ve-semantic-warning, #f59e0b) 80%, #000) 100%
		);
	}

	:global(.dialog-container.warning) .confirm-button:hover {
		background: linear-gradient(
			135deg,
			var(--ve-semantic-warning, #f59e0b) 0%,
			var(--ve-semantic-warning, #f59e0b) 100%
		);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--ve-semantic-warning, #f59e0b) 40%, transparent);
	}

	:global(.dialog-container.danger) .confirm-button {
		background: linear-gradient(
			135deg,
			var(--ve-semantic-error, #ef4444) 0%,
			var(--ve-semantic-error, #ef4444) 100%
		);
	}

	:global(.dialog-container.danger) .confirm-button:hover {
		background: linear-gradient(
			135deg,
			var(--ve-semantic-error, #ef4444) 0%,
			var(--ve-semantic-error, #ef4444) 100%
		);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--ve-semantic-error, #ef4444) 40%, transparent);
	}

	/* Delayed confirm button - visually distinct waiting state */
	.confirm-button.delayed {
		opacity: 0.5;
		cursor: not-allowed;
		background: var(--ve-theme-card-bg);
		color: var(--ve-theme-text-dim);
	}

	.confirm-button.delayed:hover {
		transform: none;
		box-shadow: none;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		:global(.dialog-container) {
			padding: 24px;
			max-width: 90%;
		}

		:global(.dialog-title) {
			font-size: var(--ve-font-size-xl);
		}

		:global(.dialog-message) {
			font-size: var(--ve-font-size-sm);
		}

		.dialog-button {
			padding: 10px 24px;
			font-size: var(--ve-font-size-sm);
			min-width: 100px;
		}

		.dialog-icon :global(.icon) {
			font-size: 2rem;
		}
	}
</style>
