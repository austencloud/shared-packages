<script lang="ts">
  import { T } from '@threlte/core';
  import type { GroundConfig } from '../types.js';

  let {
    config,
  }: {
    config: GroundConfig;
  } = $props();

  const yPos = $derived(config.yPosition ?? 0);
  const roughness = $derived(config.roughness ?? 0.8);
  const metalness = $derived(config.metalness ?? 0);
</script>

<T.Mesh rotation.x={-Math.PI / 2} position.y={yPos} receiveShadow>
  <T.PlaneGeometry args={[config.size, config.size]} />
  <T.MeshStandardMaterial
    color={config.color}
    {roughness}
    {metalness}
  />
</T.Mesh>
