<script lang="ts">
	import Popover from "../../../src/ui/kit/Popover.svelte";

	let open = $state(false);
	let anchor = $state<HTMLButtonElement | null>(null);
</script>

<div style="padding-top: 200px">
	<button bind:this={anchor} onclick={() => (open = !open)}>Zoom</button>
	<button>Outside</button>
</div>
<Popover bind:open {anchor} label="Zoom options"><p>Inside</p></Popover>
