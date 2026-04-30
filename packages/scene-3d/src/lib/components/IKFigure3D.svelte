<script lang="ts">
  import { T } from '@threlte/core';
  import type { Vector3 } from 'three';
  import type { AvatarProps } from '../domain/types.js';

  let {
    leftHandTarget = null,
    rightHandTarget = null,
    visible = true,
  }: AvatarProps = $props();

  const HEAD_Y = 1.7;
  const SHOULDER_Y = 1.45;
  const HIP_Y = 0.95;
  const SHOULDER_SPAN = 0.35;

  const leftShoulder: [number, number, number] = [-SHOULDER_SPAN / 2, SHOULDER_Y, 0];
  const rightShoulder: [number, number, number] = [SHOULDER_SPAN / 2, SHOULDER_Y, 0];

  const leftHand = $derived<[number, number, number]>(
    leftHandTarget
      ? [leftHandTarget.x, leftHandTarget.y, leftHandTarget.z]
      : [-0.3, 1.0, 0.2]
  );
  const rightHand = $derived<[number, number, number]>(
    rightHandTarget
      ? [rightHandTarget.x, rightHandTarget.y, rightHandTarget.z]
      : [0.3, 1.0, 0.2]
  );
</script>

{#if visible}
  <T.Group>
    <!-- Head -->
    <T.Mesh position.y={HEAD_Y}>
      <T.SphereGeometry args={[0.1, 16, 16]} />
      <T.MeshStandardMaterial color="#deb887" roughness={0.7} />
    </T.Mesh>

    <!-- Torso -->
    <T.Mesh position.y={(SHOULDER_Y + HIP_Y) / 2}>
      <T.CylinderGeometry args={[0.12, 0.15, SHOULDER_Y - HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#4a5568" roughness={0.8} />
    </T.Mesh>

    <!-- Left arm (shoulder to hand midpoint indicator) -->
    <T.Mesh position={[
      (leftShoulder[0] + leftHand[0]) / 2,
      (leftShoulder[1] + leftHand[1]) / 2,
      (leftShoulder[2] + leftHand[2]) / 2,
    ]}>
      <T.SphereGeometry args={[0.02, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Right arm -->
    <T.Mesh position={[
      (rightShoulder[0] + rightHand[0]) / 2,
      (rightShoulder[1] + rightHand[1]) / 2,
      (rightShoulder[2] + rightHand[2]) / 2,
    ]}>
      <T.SphereGeometry args={[0.02, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Hand spheres -->
    <T.Mesh position={leftHand}>
      <T.SphereGeometry args={[0.03, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>
    <T.Mesh position={rightHand}>
      <T.SphereGeometry args={[0.03, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Legs (static) -->
    <T.Mesh position={[-0.08, HIP_Y / 2, 0]}>
      <T.CylinderGeometry args={[0.04, 0.04, HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#2d3748" roughness={0.8} />
    </T.Mesh>
    <T.Mesh position={[0.08, HIP_Y / 2, 0]}>
      <T.CylinderGeometry args={[0.04, 0.04, HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#2d3748" roughness={0.8} />
    </T.Mesh>
  </T.Group>
{/if}
