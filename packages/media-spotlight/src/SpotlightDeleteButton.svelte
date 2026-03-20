<!--
  SpotlightDeleteButton.svelte - Delete Action with Confirmation

  A pre-built delete button with confirmation dialog.
-->
<script lang="ts">
  interface Props {
    /** Called when delete is confirmed */
    ondelete?: () => void;
    /** Confirmation text */
    confirmText?: string;
    /** Whether to require confirmation */
    requireConfirmation?: boolean;
  }

  let {
    ondelete,
    confirmText = 'Delete this item?',
    requireConfirmation = true,
  }: Props = $props();

  let showConfirm = $state(false);

  function handleClick(): void {
    if (requireConfirmation) {
      showConfirm = true;
    } else {
      ondelete?.();
    }
  }

  function handleConfirm(): void {
    showConfirm = false;
    ondelete?.();
  }

  function handleCancel(): void {
    showConfirm = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (showConfirm) {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  class="delete-button"
  onclick={handleClick}
  aria-label="Delete"
>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      fill="currentColor"
      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
    />
  </svg>
</button>

{#if showConfirm}
  <div class="confirm-overlay" role="alertdialog" aria-modal="true">
    <div class="confirm-dialog">
      <p class="confirm-text">{confirmText}</p>
      <div class="confirm-actions">
        <button class="confirm-cancel" onclick={handleCancel}>
          Cancel
        </button>
        <button class="confirm-delete" onclick={handleConfirm}>
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .delete-button {
    width: var(--spotlight-touch-min, 48px);
    height: var(--spotlight-touch-min, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--spotlight-close-bg, rgba(0, 0, 0, 0.4));
    border: none;
    border-radius: 50%;
    color: var(--spotlight-delete-color, #ef4444);
    cursor: pointer;
    transition: background 150ms ease-out;
  }

  .delete-button:hover {
    background: var(--spotlight-delete-bg, rgba(239, 68, 68, 0.15));
  }

  .confirm-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    z-index: var(--spotlight-z-dialog, 1005);
  }

  .confirm-dialog {
    background: rgba(18, 18, 28, 0.98);
    border: 1px solid var(--spotlight-delete-border, rgba(239, 68, 68, 0.5));
    border-radius: 12px;
    padding: 24px;
    max-width: 320px;
    text-align: center;
  }

  .confirm-text {
    color: white;
    font-size: 16px;
    margin: 0 0 20px 0;
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .confirm-cancel,
  .confirm-delete {
    min-width: 100px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms ease-out;
  }

  .confirm-cancel {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
  }

  .confirm-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .confirm-delete {
    background: var(--spotlight-delete-color, #ef4444);
    border: none;
    color: white;
  }

  .confirm-delete:hover {
    background: color-mix(in srgb, var(--spotlight-delete-color, #ef4444) 80%, black);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .delete-button,
    .confirm-cancel,
    .confirm-delete {
      transition: none;
    }
  }
</style>
