<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table/index.js";
	import { CreditCard } from "lucide-svelte";

	// TODO: get merchantId from user's merchant membership
	const merchantId = undefined as any;

	const cards = useQuery(api.cards.listByMerchant, () =>
		merchantId
			? {
					merchantId,
					paginationOpts: { numItems: 50, cursor: null },
				}
			: "skip",
	);

	const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
		active: "default",
		inactive: "secondary",
		suspended: "destructive",
		expired: "outline",
		cancelled: "outline",
	};

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
</script>

<PageHeader
	title="Gift Cards"
	description="Manage your gift cards"
	breadcrumbs={[{ label: "Dashboard", href: "/business" }, { label: "Gift Cards" }]}
>
	{#snippet actions()}
		<Button href="/business/cards/create">Create Card</Button>
	{/snippet}
</PageHeader>

<div class="px-6 pb-6">
	{#if cards.isLoading}
		<LoadingState message="Loading gift cards..." />
	{:else if cards.error}
		<ErrorState message={cards.error.message} />
	{:else if !cards.data || cards.data.page.length === 0}
		<EmptyState
			icon={CreditCard}
			title="No gift cards yet"
			description="Create your first gift card to start your program."
			actionLabel="Create Card"
			actionHref="/business/cards/create"
		/>
	{:else}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Card Number</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Status</TableHead>
						<TableHead class="text-right">Balance</TableHead>
						<TableHead>Customer</TableHead>
						<TableHead>Created</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each cards.data.page as card}
						<TableRow class="cursor-pointer hover:bg-muted/50">
							<TableCell>
								<a href="/business/cards/{card._id}" class="font-mono text-sm font-medium hover:underline">
									{card.cardNumber}
								</a>
							</TableCell>
							<TableCell class="capitalize">{card.type}</TableCell>
							<TableCell>
								<Badge variant={statusVariant[card.status] ?? "outline"}>
									{card.status}
								</Badge>
							</TableCell>
							<TableCell class="text-right">
								<CurrencyDisplay cents={card.currentBalance} currency={card.currency} />
							</TableCell>
							<TableCell class="text-muted-foreground">
								{card.customerId ?? "---"}
							</TableCell>
							<TableCell class="text-muted-foreground">
								{formatDate(card._creationTime)}
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>
