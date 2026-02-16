<script lang="ts">
	import { useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import { trackEvent } from "$lib/posthog.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import * as Select from "$lib/components/ui/select/index.js";

	// TODO: get merchantId from user's merchant membership
	const merchantId = undefined as any;

	const client = useConvexClient();

	let type = $state<"physical" | "digital">("digital");
	let initialBalanceDollars = $state("");
	let currency = $state("USD");
	let customerEmail = $state("");
	let isSubmitting = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		const balanceCents = Math.round(parseFloat(initialBalanceDollars) * 100);
		if (isNaN(balanceCents) || balanceCents <= 0) {
			toast.error("Please enter a valid initial balance.");
			return;
		}

		if (!merchantId) {
			toast.error("Merchant ID is not available.");
			return;
		}

		isSubmitting = true;

		try {
			await client.mutation(api.cards.createSingle, {
				merchantId,
				type,
				initialBalance: balanceCents,
				currency,
			});

			trackEvent("card_created", { type, currency, initialBalance: balanceCents });
			toast.success("Gift card created successfully.");
			goto("/business/cards");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create gift card.",
			);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<PageHeader
	title="Create Gift Card"
	description="Issue a new gift card"
	breadcrumbs={[
		{ label: "Dashboard", href: "/business" },
		{ label: "Gift Cards", href: "/business/cards" },
		{ label: "Create" },
	]}
/>

<div class="mx-auto max-w-2xl px-6 pb-6">
	<Card>
		<form onsubmit={handleSubmit}>
			<CardHeader>
				<CardTitle>New Gift Card</CardTitle>
				<CardDescription>
					Fill in the details below to create a new gift card.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="space-y-2">
					<Label for="type">Card Type</Label>
					<Select.Root
						type="single"
						value={type}
						onValueChange={(v) => {
							if (v === "physical" || v === "digital") {
								type = v;
							}
						}}
					>
						<Select.Trigger id="type" class="w-full">
							<span class="capitalize">{type}</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="physical">Physical</Select.Item>
							<Select.Item value="digital">Digital</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="balance">Initial Balance ($)</Label>
					<Input
						id="balance"
						type="number"
						placeholder="25.00"
						min="0.01"
						step="0.01"
						bind:value={initialBalanceDollars}
						required
					/>
					<p class="text-muted-foreground text-xs">
						Enter the amount in dollars. This will be the starting balance on the card.
					</p>
				</div>

				<div class="space-y-2">
					<Label for="currency">Currency</Label>
					<Select.Root
						type="single"
						value={currency}
						onValueChange={(v) => {
							if (v) currency = v;
						}}
					>
						<Select.Trigger id="currency" class="w-full">
							{currency}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="USD">USD - US Dollar</Select.Item>
							<Select.Item value="EUR">EUR - Euro</Select.Item>
							<Select.Item value="GBP">GBP - British Pound</Select.Item>
							<Select.Item value="CAD">CAD - Canadian Dollar</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="customerEmail">Customer Email (Optional)</Label>
					<Input
						id="customerEmail"
						type="email"
						placeholder="customer@example.com"
						bind:value={customerEmail}
					/>
					<p class="text-muted-foreground text-xs">
						If provided, the card will be associated with this customer.
					</p>
				</div>
			</CardContent>
			<CardFooter class="flex justify-between">
				<Button variant="outline" href="/business/cards">Cancel</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Creating..." : "Create Gift Card"}
				</Button>
			</CardFooter>
		</form>
	</Card>
</div>
