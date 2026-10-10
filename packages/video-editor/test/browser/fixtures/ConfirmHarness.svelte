<script lang="ts">
	import ConfirmDialog from "../../../src/ui/kit/ConfirmDialog.svelte";

	let result = $state("");
</script>

<ConfirmDialog
	isOpen={true}
	title="Delete clip?"
	message="This cannot be undone."
	onConfirm={() => (result = "confirmed")}
	onCancel={() => (result = "cancelled")}
/>
<p data-testid="result">{result}</p>
