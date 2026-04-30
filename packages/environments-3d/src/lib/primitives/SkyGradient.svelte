<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { SkyConfig } from '../types.js';

  let {
    config,
  }: {
    config: SkyConfig;
  } = $props();

  const radius = $derived(config.radius ?? 50);

  const material = $derived(new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(config.topColor) },
      bottomColor: { value: new THREE.Color(config.bottomColor) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  }));
</script>

<T.Mesh material={material}>
  <T.SphereGeometry args={[radius, 32, 16]} />
</T.Mesh>
