<!--
  SpotlightKeyboardHints.svelte - Keyboard Shortcuts Display

  Shows available keyboard shortcuts in a floating bar.
-->
<script lang="ts">
  import type { KeyboardHint } from './types.js';

  interface Props {
    hints?: KeyboardHint[];
  }

  let {
    hints = [
      { keys: ['←', '→'], action: 'Navigate' },
      { keys: ['Esc'], action: 'Close' },
    ],
  }: Props = $props();
</script>

<div class="spotlight-keyboard-hints" role="note" aria-label="Keyboard shortcuts">
  {#each hints as hint}
    <div class="hint-item">
      <div class="hint-keys">
        {#each hint.keys as key, i}
          {#if i > 0}
            <span class="key-separator">/</span>
          {/if}
          <kbd class="hint-key">{key}</kbd>
        {/each}
      </div>
      <span class="hint-action">{hint.action}</span>
    </div>
  {/each}
</div>

<style>
  .spotlight-keyboard-hints {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: var(--spotlight-hints-bg, rgba(0, 0, 0, 0.6));
    border-radius: 8px;
    font-size: 13px;
  }

  .hint-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hint-keys {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hint-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    background: var(--spotlight-hints-key-bg, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    color: white;
    font-family: inherit;
    font-size: 12px;
  }

  .key-separator {
    color: var(--spotlight-hints-color, rgba(255, 255, 255, 0.7));
  }

  .hint-action {
    color: var(--spotlight-hints-color, rgba(255, 255, 255, 0.7));
  }
</style>
