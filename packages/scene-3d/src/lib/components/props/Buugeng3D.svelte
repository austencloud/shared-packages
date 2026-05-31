<script lang="ts">
  import { T } from "@threlte/core";
  import { CatmullRomCurve3, Vector3 } from "three";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "../../layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    length,
    thickness,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const BUUGENG_LENGTH_RATIO = 0.9;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * BUUGENG_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);
  const rotation = $derived(computePropRotation(propState));

  const tubeRadius = $derived(baseRadius * 1.8);

  // Smooth S-curve: one full sine period sampled at 24 points.
  // Bottom arc bows left (-X), upper arc bows right (+X).
  // Amplitude ~25% of length gives proportions matching real buugeng.
  const curve = $derived.by(() => {
    const halfLen = effectiveLength / 2;
    const amplitude = effectiveLength * 0.25;
    const N = 24;
    const points: Vector3[] = [];

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = effectiveLength * (t - 0.5);
      const x = -amplitude * Math.sin(t * Math.PI * 2);
      points.push(new Vector3(x, y, 0));
    }

    return new CatmullRomCurve3(points, false, "centripetal", 0.5);
  });

  const lowerTip = $derived(curve.getPoint(0));
  const upperTip = $derived(curve.getPoint(1));

  const tipCapRadius = $derived(tubeRadius * 1.15);

  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <T.Mesh>
      <T.TubeGeometry args={[curve, 64, tubeRadius, 16, false]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <T.Mesh position={[lowerTip.x, lowerTip.y, lowerTip.z]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <T.Mesh position={[upperTip.x, upperTip.y, upperTip.z]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
