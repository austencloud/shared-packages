<!-- Black modules on a white tile with a 4-module quiet zone, so phones read it
     on dark screens too. Rendered as one SVG path; no {@html}. The corner
     radius follows the app's --radius-md when it has one. -->
<script lang="ts">
	import { encode } from 'uqr';

	interface Props {
		value: string;
		label: string;
		size?: number;
	}

	const { value, label, size = 208 }: Props = $props();

	const QUIET = 4;
	const qr = $derived(encode(value, { ecc: 'M', border: 0 }));
	const path = $derived(
		qr.data
			.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
			.join('')
	);
	const box = $derived(qr.size + QUIET * 2);
</script>

<div class="qr" style:width="{size}px" style:height="{size}px" role="img" aria-label={label}>
	<svg viewBox="{-QUIET} {-QUIET} {box} {box}" width="100%" height="100%" shape-rendering="crispEdges">
		<rect x={-QUIET} y={-QUIET} width={box} height={box} fill="#fff" />
		<path d={path} fill="#000" />
	</svg>
</div>

<style>
	.qr {
		border-radius: var(--radius-md, 12px);
		overflow: hidden;
		flex-shrink: 0;
	}

	svg {
		display: block;
	}
</style>
