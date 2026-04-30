<script lang="ts">
  import { T } from '@threlte/core';
  import type { Prop3DProps } from './Prop3DProps.js';
  import { PROP_COLORS } from '../../domain/types.js';
  import { computePropRotation } from '../../utils/prop3d-transforms.js';

  let {
    propState,
    color,
    visible = true,
    scale = 1,
  }: Prop3DProps = $props();

  const palette = $derived(PROP_COLORS[color]);
  const radius = $derived(0.04 * scale);
  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group
    position.x={propState.position.x}
    position.y={propState.position.y}
    position.z={propState.position.z}
    rotation.x={rotation[0]}
    rotation.y={rotation[1]}
    rotation.z={rotation[2]}
  >
    <T.Mesh>
      <T.SphereGeometry args={[radius, 32, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.1}
        metalness={0.3}
        opacity={0.85}
        transparent
      />
    </T.Mesh>
  </T.Group>
{/if}
