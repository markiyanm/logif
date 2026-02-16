<script lang="ts">
	let {
		cents,
		currency = "USD",
	}: {
		cents: number;
		currency?: string;
	} = $props();

	const formatted = $derived(
		new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
		}).format(cents / 100),
	);
</script>

<span>{formatted}</span>
