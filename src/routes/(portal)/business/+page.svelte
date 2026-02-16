<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import StatCard from "$lib/components/dashboard/stat-card.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import {
		CreditCard,
		CreditCardIcon,
		Users,
		ArrowUpRight,
		ArrowDownRight,
	} from "lucide-svelte";

	// TODO: get merchantId from user's merchant membership
	const merchantId = undefined as any;

	const stats = useQuery(api.merchants.getStats, () =>
		merchantId ? { merchantId } : "skip",
	);

	const totalLoadedFormatted = $derived(
		stats.data
			? new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
				}).format(stats.data.totalLoaded / 100)
			: "$0.00",
	);

	const totalRedeemedFormatted = $derived(
		stats.data
			? new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
				}).format(stats.data.totalRedeemed / 100)
			: "$0.00",
	);
</script>

<PageHeader
	title="Dashboard"
	description="Overview of your gift card program"
	breadcrumbs={[{ label: "Dashboard" }]}
/>

<div class="px-6 pb-6">
	{#if stats.isLoading}
		<LoadingState message="Loading dashboard..." />
	{:else if stats.error}
		<ErrorState message={stats.error.message} />
	{:else if stats.data}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
			<StatCard
				title="Total Cards"
				value={stats.data.cardCount.toLocaleString()}
				description="All gift cards issued"
				icon={CreditCard}
			/>
			<StatCard
				title="Active Cards"
				value={stats.data.activeCards.toLocaleString()}
				description="Currently active cards"
				icon={CreditCardIcon}
			/>
			<StatCard
				title="Total Loaded"
				value={totalLoadedFormatted}
				description="Total funds loaded"
				icon={ArrowUpRight}
			/>
			<StatCard
				title="Total Redeemed"
				value={totalRedeemedFormatted}
				description="Total funds redeemed"
				icon={ArrowDownRight}
			/>
			<StatCard
				title="Customers"
				value={stats.data.customerCount.toLocaleString()}
				description="Registered customers"
				icon={Users}
			/>
		</div>
	{/if}
</div>
