<script lang="ts">
	const { date, relative = true }: { date: Date; relative?: boolean } = $props();

	function formatRelative(d: Date): string {
		const now = Date.now();
		const diffMs = now - d.getTime();
		const diffMin = Math.floor(diffMs / 60_000);
		const diffHr = Math.floor(diffMs / 3_600_000);
		const diffDay = Math.floor(diffMs / 86_400_000);

		if (diffMin < 1) return 'Just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		if (diffHr < 24) return `${diffHr}h ago`;
		if (diffDay === 1) return 'Yesterday';
		if (diffDay < 7) return `${diffDay}d ago`;
		return d.toLocaleDateString();
	}

	function formatAbsolute(d: Date): string {
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	const display = $derived(relative ? formatRelative(date) : formatAbsolute(date));
	const tooltip = $derived(
		date.toLocaleDateString(undefined, {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	);
</script>

<time class="date-display" datetime={date.toISOString()} title={tooltip}>
	{display}
</time>

<style>
	.date-display {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		white-space: nowrap;
	}
</style>
