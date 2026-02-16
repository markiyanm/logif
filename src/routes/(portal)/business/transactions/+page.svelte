<script lang="ts">
	import { useQuery } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table/index.js";
	import { ArrowLeftRight } from "lucide-svelte";

	// TODO: get merchantId from user's merchant membership
	const merchantId = undefined as any;

	const transactions = useQuery(api.transactions.listByMerchant, () =>
		merchantId
			? {
					merchantId,
					paginationOpts: { numItems: 50, cursor: null },
				}
			: "skip",
	);

	const typeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
		load: "default",
		redeem: "destructive",
		transfer_in: "secondary",
		transfer_out: "secondary",
		adjust: "outline",
		refund: "default",
	};

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
</script>

<PageHeader
	title="Transactions"
	description="View all gift card transactions"
	breadcrumbs={[{ label: "Dashboard", href: "/business" }, { label: "Transactions" }]}
/>

<div class="px-6 pb-6">
	{#if transactions.isLoading}
		<LoadingState message="Loading transactions..." />
	{:else if transactions.error}
		<ErrorState message={transactions.error.message} />
	{:else if !transactions.data || transactions.data.page.length === 0}
		<EmptyState
			icon={ArrowLeftRight}
			title="No transactions yet"
			description="Transactions will appear here as gift cards are loaded and redeemed."
		/>
	{:else}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Date</TableHead>
						<TableHead>Card</TableHead>
						<TableHead>Type</TableHead>
						<TableHead class="text-right">Amount</TableHead>
						<TableHead class="text-right">Balance After</TableHead>
						<TableHead>Description</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each transactions.data.page as txn}
						<TableRow>
							<TableCell class="text-muted-foreground text-sm">
								{formatDate(txn._creationTime)}
							</TableCell>
							<TableCell>
								<a
									href="/business/cards/{txn.cardId}"
									class="font-mono text-sm font-medium hover:underline"
								>
									{txn.cardId}
								</a>
							</TableCell>
							<TableCell>
								<Badge variant={typeVariant[txn.type] ?? "outline"}>
									{txn.type.replace("_", " ")}
								</Badge>
							</TableCell>
							<TableCell class="text-right">
								<span
									class={txn.type === "redeem" || txn.type === "transfer_out"
										? "text-red-600 dark:text-red-400"
										: "text-green-600 dark:text-green-400"}
								>
									{txn.type === "redeem" || txn.type === "transfer_out" ? "-" : "+"}
									<CurrencyDisplay cents={Math.abs(txn.amount)} currency={txn.currency} />
								</span>
							</TableCell>
							<TableCell class="text-right">
								<CurrencyDisplay cents={txn.balanceAfter} currency={txn.currency} />
							</TableCell>
							<TableCell class="text-muted-foreground max-w-xs truncate text-sm">
								{txn.description ?? "---"}
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>
