<script lang="ts">
	import { page } from "$app/state";
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { toast } from "svelte-sonner";
	import type { Id } from "$convex/_generated/dataModel.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { trackEvent } from "$lib/posthog.js";
	import { ArrowLeftRight } from "lucide-svelte";

	const cardId = $derived(page.params.cardId as Id<"cards">);

	const client = useConvexClient();

	const cardQuery = useQuery(api.cards.getById, () => ({ cardId }));
	const transactionsQuery = useQuery(api.transactions.listByCard, () => ({ cardId }));

	// Load funds dialog
	let showLoadDialog = $state(false);
	let loadAmountDollars = $state("");
	let loadDescription = $state("");
	let isLoadingFunds = $state(false);

	// Status change
	let isChangingStatus = $state(false);

	const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
		active: "default",
		inactive: "secondary",
		suspended: "destructive",
		expired: "outline",
		cancelled: "outline",
	};

	const txnTypeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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

	function maskCode(code: string): string {
		if (code.length <= 4) return "****";
		return "****-****-" + code.slice(-4);
	}

	async function handleLoadFunds() {
		const card = cardQuery.data;
		if (!card) return;

		const amountCents = Math.round(parseFloat(loadAmountDollars) * 100);
		if (isNaN(amountCents) || amountCents <= 0) {
			toast.error("Please enter a valid amount.");
			return;
		}

		isLoadingFunds = true;
		try {
			await client.mutation(api.transactions.load, {
				merchantId: card.merchantId,
				cardId: card._id,
				amount: amountCents,
				description: loadDescription || "Funds loaded",
			});
			trackEvent("card_loaded", { cardId: card._id, amount: amountCents });
			toast.success("Funds loaded successfully.");
			showLoadDialog = false;
			loadAmountDollars = "";
			loadDescription = "";
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to load funds.",
			);
		} finally {
			isLoadingFunds = false;
		}
	}

	async function handleToggleStatus() {
		const card = cardQuery.data;
		if (!card) return;

		const newStatus = card.status === "active" ? "suspended" : "active";
		isChangingStatus = true;

		try {
			await client.mutation(api.cards.updateStatus, {
				merchantId: card.merchantId,
				cardId: card._id,
				status: newStatus,
			});
			trackEvent("card_status_changed", { cardId: card._id, newStatus });
			toast.success(`Card ${newStatus === "active" ? "activated" : "suspended"} successfully.`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update card status.",
			);
		} finally {
			isChangingStatus = false;
		}
	}
</script>

<PageHeader
	title="Card Details"
	breadcrumbs={[
		{ label: "Dashboard", href: "/business" },
		{ label: "Gift Cards", href: "/business/cards" },
		{ label: "Card Details" },
	]}
/>

<div class="space-y-6 px-6 pb-6">
	{#if cardQuery.isLoading}
		<LoadingState message="Loading card details..." />
	{:else if cardQuery.error}
		<ErrorState message={cardQuery.error.message} />
	{:else if cardQuery.data}
		{@const card = cardQuery.data}

		<!-- Card Info -->
		<div class="grid gap-6 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Card Information</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Card Number</span>
						<span class="font-mono text-sm font-medium">{card.cardNumber}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Redemption Code</span>
						<span class="font-mono text-sm">{maskCode(card.code)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Type</span>
						<span class="text-sm capitalize">{card.type}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Status</span>
						<Badge variant={statusVariant[card.status] ?? "outline"}>
							{card.status}
						</Badge>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Currency</span>
						<span class="text-sm">{card.currency}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground text-sm">Created</span>
						<span class="text-sm">{formatDate(card._creationTime)}</span>
					</div>
					{#if card.expiresAt}
						<div class="flex justify-between">
							<span class="text-muted-foreground text-sm">Expires</span>
							<span class="text-sm">{formatDate(card.expiresAt)}</span>
						</div>
					{/if}
					{#if card.lastUsedAt}
						<div class="flex justify-between">
							<span class="text-muted-foreground text-sm">Last Used</span>
							<span class="text-sm">{formatDate(card.lastUsedAt)}</span>
						</div>
					{/if}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Balance</CardTitle>
				</CardHeader>
				<CardContent class="space-y-6">
					<div>
						<p class="text-muted-foreground text-sm">Current Balance</p>
						<p class="text-3xl font-bold">
							<CurrencyDisplay cents={card.currentBalance} currency={card.currency} />
						</p>
					</div>
					<div>
						<p class="text-muted-foreground text-sm">Initial Balance</p>
						<p class="text-lg">
							<CurrencyDisplay cents={card.initialBalance} currency={card.currency} />
						</p>
					</div>

					<div class="flex flex-wrap gap-2">
						<Button onclick={() => (showLoadDialog = true)}>
							Load Funds
						</Button>
						{#if card.status === "active" || card.status === "suspended"}
							<Button
								variant={card.status === "active" ? "destructive" : "default"}
								onclick={handleToggleStatus}
								disabled={isChangingStatus}
							>
								{#if isChangingStatus}
									Updating...
								{:else if card.status === "active"}
									Suspend Card
								{:else}
									Activate Card
								{/if}
							</Button>
						{/if}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Transaction History -->
		<Card>
			<CardHeader>
				<CardTitle>Transaction History</CardTitle>
			</CardHeader>
			<CardContent>
				{#if transactionsQuery.isLoading}
					<LoadingState message="Loading transactions..." />
				{:else if transactionsQuery.error}
					<ErrorState message={transactionsQuery.error.message} />
				{:else if !transactionsQuery.data || transactionsQuery.data.length === 0}
					<EmptyState
						icon={ArrowLeftRight}
						title="No transactions yet"
						description="Transactions will appear here once funds are loaded or redeemed."
					/>
				{:else}
					<div class="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Type</TableHead>
									<TableHead class="text-right">Amount</TableHead>
									<TableHead class="text-right">Balance After</TableHead>
									<TableHead>Description</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each transactionsQuery.data as txn}
									<TableRow>
										<TableCell class="text-muted-foreground text-sm">
											{formatDate(txn._creationTime)}
										</TableCell>
										<TableCell>
											<Badge variant={txnTypeVariant[txn.type] ?? "outline"}>
												{txn.type.replace("_", " ")}
											</Badge>
										</TableCell>
										<TableCell class="text-right">
											<span class={txn.type === "redeem" || txn.type === "transfer_out" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
												{txn.type === "redeem" || txn.type === "transfer_out" ? "-" : "+"}
												<CurrencyDisplay cents={Math.abs(txn.amount)} currency={txn.currency} />
											</span>
										</TableCell>
										<TableCell class="text-right">
											<CurrencyDisplay cents={txn.balanceAfter} currency={txn.currency} />
										</TableCell>
										<TableCell class="text-muted-foreground text-sm">
											{txn.description ?? "---"}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Load Funds Dialog -->
		<Dialog.Root bind:open={showLoadDialog}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Load Funds</Dialog.Title>
					<Dialog.Description>
						Add funds to card {card.cardNumber}.
					</Dialog.Description>
				</Dialog.Header>
				<div class="space-y-4 py-4">
					<div class="space-y-2">
						<Label for="loadAmount">Amount ($)</Label>
						<Input
							id="loadAmount"
							type="number"
							placeholder="25.00"
							min="0.01"
							step="0.01"
							bind:value={loadAmountDollars}
						/>
					</div>
					<div class="space-y-2">
						<Label for="loadDescription">Description (Optional)</Label>
						<Input
							id="loadDescription"
							placeholder="Reload funds"
							bind:value={loadDescription}
						/>
					</div>
				</div>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showLoadDialog = false)}>
						Cancel
					</Button>
					<Button onclick={handleLoadFunds} disabled={isLoadingFunds}>
						{isLoadingFunds ? "Loading..." : "Load Funds"}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/if}
</div>
