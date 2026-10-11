<script lang="ts" generics="E">
	import { onDestroy, untrack } from "svelte";
	import { resolveServices } from "../host-defaults.js";
	import { createVideoEditorState } from "../state/video-editor-state.svelte.js";
	import { provideStrings } from "../strings/context.js";
	import { translatorFor } from "../strings/translate.js";
	import { provideEditorUi } from "./editor-context.js";
	import PostEditorWorkspace from "./editor/PostEditorWorkspace.svelte";
	import type { VideoEditorProps } from "./types.js";

	let {
		host: hostProp,
		plugin: pluginProp,
		editor: givenProp,
		stateOptions: stateOptionsProp,
		...rest
	}: VideoEditorProps<E> = $props();

	// Host, plugin and state are fixed for the component's life, as the workspace's editor is today.
	// `options` is required by the 2A signature and its `subjectId` scopes the saved project;
	// a host that passes neither a state nor options edits one project per owner.
	const host = untrack(() => hostProp);
	const plugin = untrack(() => pluginProp);
	const given = untrack(() => givenProp);
	const stateOptions = untrack(() => stateOptionsProp);
	const editor =
		given ?? createVideoEditorState(host, plugin, stateOptions ?? { subjectId: "default" });
	provideStrings(translatorFor(host));
	provideEditorUi({ editor, host, plugin: plugin ?? null, services: resolveServices(host) });
	onDestroy(() => {
		if (!given) editor.dispose();
	});
</script>

<div class="ve-root">
	<PostEditorWorkspace {editor} {host} plugin={plugin ?? null} {...rest} />
</div>

<style>
	.ve-root {
		display: contents;
	}
</style>
