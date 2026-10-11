<script lang="ts">
	import { untrack } from "svelte";
	import VideoEditor from "../../../src/ui/VideoEditor.svelte";
	import type { VideoEditorHost } from "../../../src/host.js";

	let { ownerId }: { ownerId: string } = $props();
	// The host is built once, at mount; a remount with the same owner reopens.
	const host: VideoEditorHost = { ownerId: untrack(() => ownerId) };
</script>

<div style="width: 1200px; height: 800px">
	<VideoEditor {host} />
</div>
