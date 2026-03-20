<!--
  SpotlightActions.svelte - Action Buttons Container

  A container for custom action buttons (delete, crop, snip, etc.)
-->
<script lang="ts">
  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="spotlight-actions" role="group" aria-label="Actions">
  {@render children()}
</div>

<style>
  .spotlight-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
</style>
