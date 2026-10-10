<script lang="ts">
	import { provideStrings } from "../../../src/strings/context.js";
	import type { Translate } from "../../../src/strings/translate.js";
	import StringsReader from "./StringsReader.svelte";

	let { translate }: { translate?: Translate } = $props();
	// Context is set once at init, which is the point of this probe.
	// svelte-ignore state_referenced_locally
	if (translate) provideStrings(translate);
</script>

<StringsReader />
