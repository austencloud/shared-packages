<script lang="ts">
	import { useStrings } from "../../../src/strings/context.js";

	const t = useStrings();
</script>

<p data-testid="text">{t("editor_missing_video", { name: "a.mp4" })}</p>
