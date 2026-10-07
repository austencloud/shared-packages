<!--
	Step 0 placeholder for the editor shell. It mounts, asks the preview
	worker for a timecode and shows the reply, so a host page can prove that
	the component, the worker and the token CSS all load from the package.
	The real editor replaces this in step 2.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { createPreviewWorker } from "../workers/index.js";
	import type { PreviewWorkerPong } from "../workers/messages.js";

	let { seconds = 83.5 }: { seconds?: number } = $props();
	let status = $state("waiting");

	onMount(() => {
		const worker = createPreviewWorker();
		worker.addEventListener("message", (event: MessageEvent<PreviewWorkerPong>) => {
			const { timecode, mediabunny } = event.data;
			status = `pong ${timecode} ${mediabunny ? "mediabunny" : "no-mediabunny"}`;
		});
		worker.addEventListener("error", (event) => {
			status = `error ${event.message}`;
		});
		worker.postMessage({ type: "ping", seconds });
		return () => worker.terminate();
	});
</script>

<div class="ve-shell" data-ve-status={status}>
	<p class="ve-title">Video editor spike</p>
	<p class="ve-status">{status}</p>
</div>

<style>
	.ve-shell {
		background: var(--ve-surface, #1e1e25);
		color: var(--ve-text, #f3f3f5);
		border: 1px solid var(--ve-stroke, rgba(255, 255, 255, 0.12));
		border-radius: var(--ve-radius, 12px);
		padding: 16px;
		font-family: var(--ve-font, system-ui, sans-serif);
	}
	.ve-title {
		margin: 0 0 4px;
		font-weight: 600;
	}
	.ve-status {
		margin: 0;
		color: var(--ve-text-dim, #9a9aa5);
		font-variant-numeric: tabular-nums;
	}
</style>
