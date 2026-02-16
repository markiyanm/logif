<script lang="ts">
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { toast } from "svelte-sonner";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import CurrencyDisplay from "$lib/components/shared/currency-display.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
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
	import { Users } from "lucide-svelte";

	// TODO: get merchantId from user's merchant membership
	const merchantId = undefined as any;

	const client = useConvexClient();

	const customers = useQuery(api.customers.listByMerchant, () =>
		merchantId
			? {
					merchantId,
					numItems: 50,
					cursor: null,
				}
			: "skip",
	);

	// Add customer dialog
	let showAddDialog = $state(false);
	let newName = $state("");
	let newEmail = $state("");
	let newPhone = $state("");
	let isAdding = $state(false);

	async function handleAddCustomer() {
		if (!newEmail.trim()) {
			toast.error("Email is required.");
			return;
		}

		if (!merchantId) {
			toast.error("Merchant ID is not available.");
			return;
		}

		isAdding = true;
		try {
			await client.mutation(api.customers.create, {
				merchantId,
				email: newEmail.trim(),
				name: newName.trim() || undefined,
				phone: newPhone.trim() || undefined,
			});
			toast.success("Customer added successfully.");
			showAddDialog = false;
			newName = "";
			newEmail = "";
			newPhone = "";
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to add customer.",
			);
		} finally {
			isAdding = false;
		}
	}
</script>

<PageHeader
	title="Customers"
	description="Manage your customer base"
	breadcrumbs={[{ label: "Dashboard", href: "/business" }, { label: "Customers" }]}
>
	{#snippet actions()}
		<Button onclick={() => (showAddDialog = true)}>Add Customer</Button>
	{/snippet}
</PageHeader>

<div class="px-6 pb-6">
	{#if customers.isLoading}
		<LoadingState message="Loading customers..." />
	{:else if customers.error}
		<ErrorState message={customers.error.message} />
	{:else if !customers.data || customers.data.page.length === 0}
		<EmptyState
			icon={Users}
			title="No customers yet"
			description="Add your first customer to get started."
			actionLabel="Add Customer"
			onaction={() => (showAddDialog = true)}
		/>
	{:else}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Phone</TableHead>
						<TableHead class="text-center">Cards</TableHead>
						<TableHead class="text-right">Loyalty Points</TableHead>
						<TableHead class="text-right">Total Spent</TableHead>
						<TableHead class="text-right">Total Loaded</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each customers.data.page as customer}
						<TableRow>
							<TableCell class="font-medium">
								{customer.name ?? "---"}
							</TableCell>
							<TableCell>{customer.email}</TableCell>
							<TableCell class="text-muted-foreground">
								{customer.phone ?? "---"}
							</TableCell>
							<TableCell class="text-center">
								{customer.cardCount}
							</TableCell>
							<TableCell class="text-right">
								{customer.loyaltyPoints.toLocaleString()}
							</TableCell>
							<TableCell class="text-right">
								<CurrencyDisplay cents={customer.totalSpent} />
							</TableCell>
							<TableCell class="text-right">
								<CurrencyDisplay cents={customer.totalLoaded} />
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>

<!-- Add Customer Dialog -->
<Dialog.Root bind:open={showAddDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Customer</Dialog.Title>
			<Dialog.Description>
				Create a new customer record for your business.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="customerName">Name</Label>
				<Input
					id="customerName"
					placeholder="John Doe"
					bind:value={newName}
				/>
			</div>
			<div class="space-y-2">
				<Label for="customerEmail">Email</Label>
				<Input
					id="customerEmail"
					type="email"
					placeholder="john@example.com"
					bind:value={newEmail}
					required
				/>
			</div>
			<div class="space-y-2">
				<Label for="customerPhone">Phone (Optional)</Label>
				<Input
					id="customerPhone"
					type="tel"
					placeholder="+1 (555) 000-0000"
					bind:value={newPhone}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showAddDialog = false)}>
				Cancel
			</Button>
			<Button onclick={handleAddCustomer} disabled={isAdding}>
				{isAdding ? "Adding..." : "Add Customer"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
