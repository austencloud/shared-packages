<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  let {
    variant = 'firefly',
  }: {
    variant?: 'firefly' | 'autumn';
  } = $props();

  const backgroundType = $derived(
    variant === 'autumn' ? BackgroundType.AUTUMN_DRIFT : BackgroundType.FIREFLY_FOREST
  );
  const preset = $derived(getScenePreset(backgroundType)!);
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
