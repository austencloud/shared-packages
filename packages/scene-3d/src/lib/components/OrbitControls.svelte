<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  import { OrbitControls as ThreeOrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { onMount, onDestroy } from 'svelte';

  let {
    target = [0, 1, 0],
    enableDamping = true,
    dampingFactor = 0.05,
    minDistance = 1,
    maxDistance = 20,
    maxPolarAngle = Math.PI * 0.85,
  }: {
    target?: [number, number, number];
    enableDamping?: boolean;
    dampingFactor?: number;
    minDistance?: number;
    maxDistance?: number;
    maxPolarAngle?: number;
  } = $props();

  const { camera, renderer } = useThrelte();
  let controls: ThreeOrbitControls | null = null;

  onMount(() => {
    const canvas = renderer.domElement;
    controls = new ThreeOrbitControls(camera.current, canvas);
    controls.enableDamping = enableDamping;
    controls.dampingFactor = dampingFactor;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.maxPolarAngle = maxPolarAngle;
    controls.target.set(...target);
  });

  useTask(() => {
    controls?.update();
  });

  onDestroy(() => {
    controls?.dispose();
  });
</script>
