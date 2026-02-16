<script lang="ts">
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { toast } from "svelte-sonner";
	import type { Id } from "$convex/_generated/dataModel.js";
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import ErrorState from "$lib/components/shared/error-state.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
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
	const merchantId = undefined as unknown as Id<"merchants">;

	const client = useConvexClient();

	const merchant = useQuery(api.merchants.getById, () =>
		merchantId ? { merchantId } : "skip",
	);

	// Profile form state
	let profileName = $state("");
	let profileEmail = $state("");
	let profilePhone = $state("");
	let profileWebsite = $state("");
	let profileDescription = $state("");
	let profileStreet = $state("");
	let profileCity = $state("");
	let profileState = $state("");
	let profileZip = $state("");
	let profileCountry = $state("");
	let isSavingProfile = $state(false);

	// Settings form state
	let defaultCardExpDays = $state("");
	let maxCardBalance = $state("");
	let minLoadAmount = $state("");
	let maxLoadAmount = $state("");
	let allowPartialRedeem = $state(true);
	let requirePin = $state(false);
	let settingsCurrency = $state("USD");
	let isSavingSettings = $state(false);

	// Populate form when merchant data loads
	$effect(() => {
		if (merchant.data) {
			const m = merchant.data;
			profileName = m.name;
			profileEmail = m.contactEmail;
			profilePhone = m.phone ?? "";
			profileWebsite = m.website ?? "";
			profileDescription = m.description ?? "";
			profileStreet = m.address?.street ?? "";
			profileCity = m.address?.city ?? "";
			profileState = m.address?.state ?? "";
			profileZip = m.address?.zip ?? "";
			profileCountry = m.address?.country ?? "";

			const s = m.settings;
			defaultCardExpDays = s?.defaultCardExpDays?.toString() ?? "";
			maxCardBalance = s?.maxCardBalance ? (s.maxCardBalance / 100).toString() : "";
			minLoadAmount = s?.minLoadAmount ? (s.minLoadAmount / 100).toString() : "";
			maxLoadAmount = s?.maxLoadAmount ? (s.maxLoadAmount / 100).toString() : "";
			allowPartialRedeem = s?.allowPartialRedeem ?? true;
			requirePin = s?.requirePin ?? false;
			settingsCurrency = s?.currency ?? "USD";
		}
	});

	async function handleSaveProfile() {
		if (!merchantId) {
			toast.error("Merchant ID is not available.");
			return;
		}

		isSavingProfile = true;
		try {
			const hasAddress = profileStreet || profileCity || profileState || profileZip || profileCountry;

			await client.mutation(api.merchants.update, {
				merchantId,
				name: profileName,
				contactEmail: profileEmail,
				phone: profilePhone || undefined,
				website: profileWebsite || undefined,
				description: profileDescription || undefined,
				address: hasAddress
					? {
							street: profileStreet,
							city: profileCity,
							state: profileState,
							zip: profileZip,
							country: profileCountry,
						}
					: undefined,
			});
			toast.success("Profile updated successfully.");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile.",
			);
		} finally {
			isSavingProfile = false;
		}
	}

	async function handleSaveSettings() {
		if (!merchantId) {
			toast.error("Merchant ID is not available.");
			return;
		}

		isSavingSettings = true;
		try {
			await client.mutation(api.merchants.updateSettings, {
				merchantId,
				settings: {
					defaultCardExpDays: defaultCardExpDays ? parseInt(defaultCardExpDays) : undefined,
					maxCardBalance: maxCardBalance ? Math.round(parseFloat(maxCardBalance) * 100) : undefined,
					minLoadAmount: minLoadAmount ? Math.round(parseFloat(minLoadAmount) * 100) : undefined,
					maxLoadAmount: maxLoadAmount ? Math.round(parseFloat(maxLoadAmount) * 100) : undefined,
					allowPartialRedeem,
					requirePin,
					currency: settingsCurrency,
				},
			});
			toast.success("Settings updated successfully.");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update settings.",
			);
		} finally {
			isSavingSettings = false;
		}
	}
</script>

<PageHeader
	title="Settings"
	description="Manage your merchant profile and program settings"
	breadcrumbs={[{ label: "Dashboard", href: "/business" }, { label: "Settings" }]}
/>

<div class="space-y-6 px-6 pb-6">
	{#if merchant.isLoading}
		<LoadingState message="Loading settings..." />
	{:else if merchant.error}
		<ErrorState message={merchant.error.message} />
	{:else}
		<!-- Merchant Profile -->
		<Card>
			<CardHeader>
				<CardTitle>Merchant Profile</CardTitle>
				<CardDescription>
					Update your business information visible to customers and partners.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="profileName">Business Name</Label>
						<Input id="profileName" bind:value={profileName} placeholder="My Business" />
					</div>
					<div class="space-y-2">
						<Label for="profileEmail">Contact Email</Label>
						<Input id="profileEmail" type="email" bind:value={profileEmail} placeholder="contact@mybusiness.com" />
					</div>
				</div>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="profilePhone">Phone</Label>
						<Input id="profilePhone" type="tel" bind:value={profilePhone} placeholder="+1 (555) 000-0000" />
					</div>
					<div class="space-y-2">
						<Label for="profileWebsite">Website</Label>
						<Input id="profileWebsite" type="url" bind:value={profileWebsite} placeholder="https://mybusiness.com" />
					</div>
				</div>
				<div class="space-y-2">
					<Label for="profileDescription">Description</Label>
					<Textarea
						id="profileDescription"
						bind:value={profileDescription}
						placeholder="A brief description of your business..."
						rows={3}
					/>
				</div>

				<div>
					<h4 class="mb-3 text-sm font-medium">Address</h4>
					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="profileStreet">Street</Label>
							<Input id="profileStreet" bind:value={profileStreet} placeholder="123 Main St" />
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="profileCity">City</Label>
								<Input id="profileCity" bind:value={profileCity} placeholder="San Francisco" />
							</div>
							<div class="space-y-2">
								<Label for="profileState">State</Label>
								<Input id="profileState" bind:value={profileState} placeholder="CA" />
							</div>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="profileZip">ZIP Code</Label>
								<Input id="profileZip" bind:value={profileZip} placeholder="94105" />
							</div>
							<div class="space-y-2">
								<Label for="profileCountry">Country</Label>
								<Input id="profileCountry" bind:value={profileCountry} placeholder="US" />
							</div>
						</div>
					</div>
				</div>
			</CardContent>
			<CardFooter class="flex justify-end">
				<Button onclick={handleSaveProfile} disabled={isSavingProfile}>
					{isSavingProfile ? "Saving..." : "Save Profile"}
				</Button>
			</CardFooter>
		</Card>

		<!-- Program Settings -->
		<Card>
			<CardHeader>
				<CardTitle>Program Settings</CardTitle>
				<CardDescription>
					Configure default values and rules for your gift card program.
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="expDays">Default Card Expiry (Days)</Label>
						<Input
							id="expDays"
							type="number"
							bind:value={defaultCardExpDays}
							placeholder="365"
							min="1"
						/>
						<p class="text-muted-foreground text-xs">
							Number of days until newly created cards expire.
						</p>
					</div>
					<div class="space-y-2">
						<Label for="maxBalance">Max Card Balance ($)</Label>
						<Input
							id="maxBalance"
							type="number"
							bind:value={maxCardBalance}
							placeholder="500.00"
							min="0"
							step="0.01"
						/>
						<p class="text-muted-foreground text-xs">
							Maximum allowed balance on a single card.
						</p>
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="minLoad">Min Load Amount ($)</Label>
						<Input
							id="minLoad"
							type="number"
							bind:value={minLoadAmount}
							placeholder="5.00"
							min="0"
							step="0.01"
						/>
					</div>
					<div class="space-y-2">
						<Label for="maxLoad">Max Load Amount ($)</Label>
						<Input
							id="maxLoad"
							type="number"
							bind:value={maxLoadAmount}
							placeholder="500.00"
							min="0"
							step="0.01"
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="settingsCurrency">Default Currency</Label>
					<Select.Root
						type="single"
						value={settingsCurrency}
						onValueChange={(v) => {
							if (v) settingsCurrency = v;
						}}
					>
						<Select.Trigger id="settingsCurrency" class="w-full md:w-64">
							{settingsCurrency}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="USD">USD - US Dollar</Select.Item>
							<Select.Item value="EUR">EUR - Euro</Select.Item>
							<Select.Item value="GBP">GBP - British Pound</Select.Item>
							<Select.Item value="CAD">CAD - Canadian Dollar</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-4">
					<div class="flex items-center justify-between rounded-lg border p-4">
						<div>
							<p class="text-sm font-medium">Allow Partial Redemptions</p>
							<p class="text-muted-foreground text-xs">
								Allow customers to redeem less than the full card balance.
							</p>
						</div>
						<Switch bind:checked={allowPartialRedeem} />
					</div>

					<div class="flex items-center justify-between rounded-lg border p-4">
						<div>
							<p class="text-sm font-medium">Require PIN</p>
							<p class="text-muted-foreground text-xs">
								Require a PIN for card redemptions.
							</p>
						</div>
						<Switch bind:checked={requirePin} />
					</div>
				</div>
			</CardContent>
			<CardFooter class="flex justify-end">
				<Button onclick={handleSaveSettings} disabled={isSavingSettings}>
					{isSavingSettings ? "Saving..." : "Save Settings"}
				</Button>
			</CardFooter>
		</Card>
	{/if}
</div>
