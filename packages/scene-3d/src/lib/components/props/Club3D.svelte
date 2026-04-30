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
  const rotation = $derived(computePropRotation(propState));

  const bodyLength = $derived(0.4 * scale);
  const bodyRadius = $derived(0.03 * scale);
  const knobRadius = $derived(0.045 * scale);
  const handleRadius = $derived(0.015 * scale);
  const handleLength = $derived(0.12 * scale);
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
    <!-- Club body (tapered cylinder) -->
    <T.Mesh position.y={handleLength / 2}>
      <T.CylinderGeometry args={[bodyRadius * 0.6, bodyRadius, bodyLength, 16]} />
      <T.MeshStandardMaterial color={palette.main} roughness={0.4} metalness={0.1} />
    </T.Mesh>

    <!-- Knob (top) -->
    <T.Mesh position.y={handleLength / 2 + bodyLength / 2}>
      <T.SphereGeometry args={[knobRadius, 16, 16]} />
      <T.MeshStandardMaterial color={palette.main} roughness={0.3} metalness={0.2} />
    </T.Mesh>

    <!-- Handle (bottom) -->
    <T.Mesh position.y={-handleLength / 2}>
      <T.CylinderGeometry args={[handleRadius, handleRadius, handleLength, 12]} />
      <T.MeshStandardMaterial color={palette.dark} roughness={0.6} metalness={0.0} />
    </T.Mesh>
  </T.Group>
{/if}
