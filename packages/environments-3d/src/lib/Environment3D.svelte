<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import type { EnvironmentProps } from './types.js';
  import OceanScene from './scenes/OceanScene.svelte';
  import EmberScene from './scenes/EmberScene.svelte';
  import CherryBlossomScene from './scenes/CherryBlossomScene.svelte';
  import CosmicScene from './scenes/CosmicScene.svelte';
  import ForestScene from './scenes/ForestScene.svelte';
  import WinterScene from './scenes/WinterScene.svelte';

  let {
    backgroundType,
    onReady,
  }: EnvironmentProps = $props();

  $effect(() => {
    onReady?.();
  });
</script>

{#if backgroundType === BackgroundType.DEEP_OCEAN}
  <OceanScene />
{:else if backgroundType === BackgroundType.EMBER_GLOW}
  <EmberScene />
{:else if backgroundType === BackgroundType.CHERRY_BLOSSOM}
  <CherryBlossomScene />
{:else if backgroundType === BackgroundType.NIGHT_SKY}
  <CosmicScene />
{:else if backgroundType === BackgroundType.FIREFLY_FOREST}
  <ForestScene variant="firefly" />
{:else if backgroundType === BackgroundType.AUTUMN_DRIFT}
  <ForestScene variant="autumn" />
{:else if backgroundType === BackgroundType.SNOWFALL}
  <WinterScene />
{/if}
