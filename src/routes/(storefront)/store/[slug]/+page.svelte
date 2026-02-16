<script lang="ts">
	import { useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from "$lib/components/ui/card/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import { trackEvent } from "$lib/posthog.js";

	let cardNumber = $state("");
	let isChecking = $state(false);
	let result = $state<{
		currentBalance: number;
		currency: string;
		status: "active" | "inactive" | "suspended" | "expired" | "cancelled";
	} | null>(null);
	let hasSearched = $state(false);
	let errorMessage = $state("");

	const client = useConvexClient();

	async function handleCheckBalance() {
		const trimmed = cardNumber.trim();
		if (!trimmed) return;

		isChecking = true;
		errorMessage = "";
		result = null;
		hasSearched = true;

		try {
			result = await client.query(api.cards.checkBalance, {
				cardNumber: trimmed,
			});
			trackEvent("balance_checked", { found: !!result });
		} catch (err) {
			errorMessage = "An error occurred while checking the balance. Please try again.";
		} finally {
			isChecking = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			handleCheckBalance();
		}
	}

	const statusVariant = $derived.by(() => {
		if (!result) return "default" as const;
		switch (result.status) {
			case "active":
				return "default" as const;
			case "inactive":
				return "secondary" as const;
			case "suspended":
				return "destructive" as const;
			case "expired":
				return "outline" as const;
			case "cancelled":
				return "destructive" as const;
			default:
				return "default" as const;
		}
	});
</script>

<div class="flex flex-col items-center gap-8">
	<div class="text-center">
		<h2 class="text-2xl font-bold tracking-tight">Check Gift Card Balance</h2>
		<p class="text-muted-foreground mt-1 text-sm">
			Enter your gift card number to check your remaining balance.
		</p>
	</div>

	<Card class="w-full max-w-md">
		<CardHeader>
			<CardTitle>Card Lookup</CardTitle>
			<CardDescription>Enter the number printed on your gift card.</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="card-number">Card Number</Label>
					<Input
						id="card-number"
						type="text"
						placeholder="Enter your card number"
						bind:value={cardNumber}
						onkeydown={handleKeydown}
					/>
				</div>
				<Button
					onclick={handleCheckBalance}
					disabled={isChecking || !cardNumber.trim()}
					class="w-full"
				>
					{isChecking ? "Checking..." : "Check Balance"}
				</Button>
			</div>
		</CardContent>
	</Card>

	{#if isChecking}
		<LoadingState message="Looking up your card..." />
	{:else if errorMessage}
		<Card class="w-full max-w-md border-destructive">
			<CardContent class="pt-6">
				<p class="text-destructive text-center text-sm">{errorMessage}</p>
			</CardContent>
		</Card>
	{:else if hasSearched && !result}
		<Card class="w-full max-w-md">
			<CardContent class="pt-6">
				<p class="text-muted-foreground text-center text-sm">
					No gift card found with that number. Please check and try again.
				</p>
			</CardContent>
		</Card>
	{:else if result}
		<Card class="w-full max-w-md">
			<CardHeader>
				<CardTitle class="text-center">Your Balance</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col items-center gap-4">
					<p class="text-4xl font-bold">
						<CurrencyDisplay cents={result.currentBalance} currency={result.currency} />
					</p>
					<Badge variant={statusVariant}>
						{result.status.charAt(0).toUpperCase() + result.status.slice(1)}
					</Badge>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
