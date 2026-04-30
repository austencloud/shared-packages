<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import OrbitControls from './OrbitControls.svelte';
  import type { SceneConfig } from '../domain/types.js';
  import type { Snippet } from 'svelte';

  let {
    config = {},
    children,
  }: {
    config?: SceneConfig;
    children?: Snippet;
  } = $props();

  const lighting = $derived(config.lighting ?? {});
  const camera = $derived(config.camera ?? {});
  const grid = $derived(config.grid ?? {});

  const ambientIntensity = $derived(lighting.ambientIntensity ?? 0.6);
  const ambientColor = $derived(lighting.ambientColor ?? '#ffffff');
  const mainLightIntensity = $derived(lighting.mainLightIntensity ?? 0.8);
  const mainLightColor = $derived(lighting.mainLightColor ?? '#ffffff');
  const mainLightPos = $derived(lighting.mainLightPosition ?? [5, 10, 5]);

  const cameraPos = $derived(camera.position ?? [0, 1.5, 4]);
  const cameraTarget = $derived(camera.target ?? [0, 1, 0]);
  const fov = $derived(camera.fov ?? 50);
  const near = $derived(camera.near ?? 0.1);
  const far = $derived(camera.far ?? 100);
</script>

<Canvas>
  <T.PerspectiveCamera
    makeDefault
    position={cameraPos}
    {fov}
    {near}
    {far}
  />

  <OrbitControls target={cameraTarget} />

  <T.AmbientLight intensity={ambientIntensity} color={ambientColor} />
  <T.DirectionalLight
    intensity={mainLightIntensity}
    color={mainLightColor}
    position={mainLightPos}
    castShadow
  />

  {#if grid.visible}
    <T.GridHelper args={[grid.size ?? 10, grid.divisions ?? 10, grid.color ?? '#444444', '#222222']} />
  {/if}

  {@render children?.()}
</Canvas>
