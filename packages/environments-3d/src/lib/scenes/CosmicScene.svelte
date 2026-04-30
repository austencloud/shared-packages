<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.NIGHT_SKY)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
