<!--
	Step 0 placeholder for the editor shell. It mounts, asks the preview
	worker for a timecode and shows the reply, so a host page can prove that
	the component, the worker and the token CSS all load from the package.
	The real editor is `VideoEditor.svelte`; this spike stays until step 4.
-->
<script lang="ts">
	import { onMount } from "svelte";
	import { createSpikeWorker } from "../workers/index.js";
	import type { SpikeWorkerPing, SpikeWorkerPong } from "../workers/messages.js";

	let { seconds = 83.5 }: { seconds?: number } = $props();
	let status = $state("waiting");

	onMount(() => {
		let worker: Worker;
		try {
			worker = createSpikeWorker();
		} catch (error) {
			status = `error construct ${String(error)}`;
			return;
		}
		worker.addEventListener("message", (event: MessageEvent<SpikeWorkerPong>) => {
			const { timecode, mediabunny } = event.data;
			status = `pong ${timecode} ${mediabunny ? "mediabunny" : "no-mediabunny"}`;
		});
		worker.addEventListener("error", (event) => {
			// A module worker that fails to load fires a plain Event, not an ErrorEvent.
			status = `error ${event instanceof ErrorEvent && event.message ? event.message : "worker failed to load"}`;
		});
		worker.addEventListener("messageerror", () => {
			status = "error messageerror";
		});
		worker.postMessage({ type: "ping", seconds } satisfies SpikeWorkerPing);
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
