<script lang="ts">
  import { T } from '@threlte/core';
  import { Vector3 } from 'three';

  let {
    from,
    to,
    radius = 0.02,
    color = '#cccccc',
  }: {
    from: [number, number, number];
    to: [number, number, number];
    radius?: number;
    color?: string;
  } = $props();

  const midpoint = $derived([
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ] as [number, number, number]);

  const length = $derived(
    new Vector3(...from).distanceTo(new Vector3(...to))
  );
</script>

<T.Mesh position={midpoint}>
  <T.CylinderGeometry args={[radius, radius, length, 8]} />
  <T.MeshStandardMaterial {color} roughness={0.6} />
</T.Mesh>
