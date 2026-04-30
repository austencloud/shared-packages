<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { createAvatarServices } from '../services/AvatarServicesFactory.js';
  import IKFigure3D from './IKFigure3D.svelte';
  import type { AvatarProps } from '../domain/types.js';

  let {
    avatarModelUrl,
    leftHandTarget = null,
    rightHandTarget = null,
    visible = true,
  }: AvatarProps = $props();

  const services = createAvatarServices({
    enableFootPlanting: false,
  });

  let modelLoaded = $state(false);
  let useFallback = $state(true);

  $effect(() => {
    if (!avatarModelUrl) {
      useFallback = true;
      return;
    }
    services.skeleton.loadModel(avatarModelUrl)
      .then(() => {
        modelLoaded = true;
        useFallback = false;
      })
      .catch(() => {
        useFallback = true;
      });
  });

  useTask(() => {
    if (!modelLoaded) return;

    const leftChain = services.skeleton.getLeftArmChain();
    const rightChain = services.skeleton.getRightArmChain();

    if (leftHandTarget && leftChain) {
      services.ikSolver.solveAndApply(leftChain, {
        position: leftHandTarget,
        weight: 1,
      });
    }

    if (rightHandTarget && rightChain) {
      services.ikSolver.solveAndApply(rightChain, {
        position: rightHandTarget,
        weight: 1,
      });
    }

    services.skeleton.updateMatrices();
  });
</script>

{#if visible}
  {#if useFallback}
    <IKFigure3D {leftHandTarget} {rightHandTarget} {visible} />
  {:else if modelLoaded}
    {@const root = services.skeleton.getRoot()}
    {#if root}
      <T is={root} />
    {/if}
  {/if}
{/if}
