<!--
  SpotlightTagBar.svelte - Tag Management Bar

  Displays available tags with number key shortcuts for quick tagging.
-->
<script lang="ts">
  import type { MediaTag, TagColor } from './types.js';

  interface Props {
    /** Available tags to display */
    tags: MediaTag[];
    /** Currently active tag IDs */
    activeTags?: string[];
    /** Called when a tag is toggled */
    ontoggle?: (tagId: string) => void;
    /** Whether keyboard shortcuts are active (set to false when spotlight is closed) */
    keyboardActive?: boolean;
  }

  let {
    tags,
    activeTags = [],
    ontoggle,
    keyboardActive = true,
  }: Props = $props();

  // Handle number key shortcuts (1-9) - only when active
  function handleKeydown(e: KeyboardEvent): void {
    if (!keyboardActive) return;

    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= tags.length) {
      e.preventDefault();
      const tag = tags[num - 1];
      if (tag) {
        ontoggle?.(tag.id);
      }
    }
  }

  function isActive(tagId: string): boolean {
    return activeTags.includes(tagId);
  }

  function getColorVar(color: TagColor): string {
    return `var(--spotlight-tag-${color}, #6b7280)`;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="spotlight-tag-bar" role="group" aria-label="Tags">
  {#each tags as tag, i}
    <button
      class="tag-chip"
      class:active={isActive(tag.id)}
      style:--tag-color={getColorVar(tag.color)}
      onclick={() => ontoggle?.(tag.id)}
      aria-pressed={isActive(tag.id)}
    >
      {#if i < 9}
        <span class="tag-key">{i + 1}</span>
      {/if}
      <span class="tag-name">{tag.name}</span>
    </button>
  {/each}
</div>

<style>
  .spotlight-tag-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }

  .tag-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition:
      background 150ms ease-out,
      border-color 150ms ease-out,
      transform 150ms var(--spotlight-ease-spring);
    min-height: var(--spotlight-touch-min, 48px);
  }

  .tag-chip:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .tag-chip.active {
    background: color-mix(in srgb, var(--tag-color) 30%, transparent);
    border-color: var(--tag-color);
    transform: scale(1.05);
  }

  .tag-key {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .tag-chip.active .tag-key {
    background: var(--tag-color);
    color: black;
  }

  .tag-name {
    white-space: nowrap;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .tag-chip {
      transition: none;
    }
  }
</style>
