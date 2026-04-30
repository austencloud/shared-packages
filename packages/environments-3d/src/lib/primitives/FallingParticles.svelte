<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';
  import type { ParticleConfig } from '../types.js';

  let {
    config,
  }: {
    config: ParticleConfig;
  } = $props();

  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const velocities = new Float32Array(config.count * 3);

  const colorArray = Array.isArray(config.color) ? config.color : [config.color];
  const halfArea: [number, number, number] = [
    config.areaSize[0] / 2,
    config.areaSize[1] / 2,
    config.areaSize[2] / 2,
  ];

  for (let i = 0; i < config.count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * config.areaSize[0];
    positions[i3 + 1] = Math.random() * config.areaSize[1];
    positions[i3 + 2] = (Math.random() - 0.5) * config.areaSize[2];

    const c = new THREE.Color(colorArray[Math.floor(Math.random() * colorArray.length)]);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    const drift = config.drift ?? 0;
    velocities[i3] = (Math.random() - 0.5) * drift * config.speed;
    velocities[i3 + 1] = config.direction[1] * config.speed * (0.8 + Math.random() * 0.4);
    velocities[i3 + 2] = (Math.random() - 0.5) * drift * config.speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: config.size,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  useTask((delta) => {
    const posAttr = geometry.attributes['position'] as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      pos[i3] += velocities[i3] * delta;
      pos[i3 + 1] += velocities[i3 + 1] * delta;
      pos[i3 + 2] += velocities[i3 + 2] * delta;

      if (pos[i3 + 1] > halfArea[1]) pos[i3 + 1] = -halfArea[1];
      if (pos[i3 + 1] < -halfArea[1]) pos[i3 + 1] = halfArea[1];
      if (pos[i3] > halfArea[0]) pos[i3] = -halfArea[0];
      if (pos[i3] < -halfArea[0]) pos[i3] = halfArea[0];
      if (pos[i3 + 2] > halfArea[2]) pos[i3 + 2] = -halfArea[2];
      if (pos[i3 + 2] < -halfArea[2]) pos[i3 + 2] = halfArea[2];
    }

    posAttr.needsUpdate = true;
  });
</script>

<T.Points {geometry} {material} />
