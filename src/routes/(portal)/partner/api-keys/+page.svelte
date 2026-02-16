<script lang="ts">
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Checkbox } from "$lib/components/ui/checkbox/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import { Key, Plus } from "lucide-svelte";

	let { data } = $props();

	let dialogOpen = $state(false);
	let newKeyName = $state("");
	let newKeyEnvironment = $state<"live" | "test">("test");
	let newKeyPermissions = $state<Record<string, boolean>>({
		"cards:read": false,
		"cards:write": false,
		"transactions:read": false,
		"transactions:write": false,
		"merchants:read": false,
		"customers:read": false,
		"customers:write": false,
	});
	let isCreating = $state(false);

	const availablePermissions = [
		{ key: "cards:read", label: "Read Cards" },
		{ key: "cards:write", label: "Write Cards" },
		{ key: "transactions:read", label: "Read Transactions" },
		{ key: "transactions:write", label: "Write Transactions" },
		{ key: "merchants:read", label: "Read Merchants" },
		{ key: "customers:read", label: "Read Customers" },
		{ key: "customers:write", label: "Write Customers" },
	];

	// Placeholder data since there is no dedicated partner API keys query yet
	// In a real implementation this would use a Convex query like:
	// const apiKeysQuery = useQuery(api.apiKeys.listByPartner, { partnerId });
	let apiKeys = $state<
		Array<{
			_id: string;
			name: string;
			keyPrefix: string;
			environment: "live" | "test";
			permissions: string[];
			status: "active" | "revoked";
			lastUsedAt?: number;
			_creationTime: number;
		}>
	>([]);

	function formatDate(timestamp: number | undefined): string {
		if (!timestamp) return "Never";
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	function envVariant(env: string) {
		return env === "live" ? ("default" as const) : ("secondary" as const);
	}

	function statusVariant(status: string) {
		return status === "active"
			? ("default" as const)
			: ("destructive" as const);
	}

	function resetForm() {
		newKeyName = "";
		newKeyEnvironment = "test";
		newKeyPermissions = Object.fromEntries(
			availablePermissions.map((p) => [p.key, false]),
		);
	}

	async function handleCreateKey() {
		if (!newKeyName.trim()) return;

		isCreating = true;
		try {
			const selectedPermissions = Object.entries(newKeyPermissions)
				.filter(([, enabled]) => enabled)
				.map(([key]) => key);

			// In a real implementation, this would call a Convex mutation:
			// await client.mutation(api.apiKeys.create, { ... });
			console.log("Creating API key:", {
				name: newKeyName,
				environment: newKeyEnvironment,
				permissions: selectedPermissions,
			});

			dialogOpen = false;
			resetForm();
		} finally {
			isCreating = false;
		}
	}

	function togglePermission(key: string) {
		newKeyPermissions = {
			...newKeyPermissions,
			[key]: !newKeyPermissions[key],
		};
	}
</script>

<PageHeader
	title="API Keys"
	breadcrumbs={[
		{ label: "Partner", href: "/partner" },
		{ label: "API Keys" },
	]}
>
	{#snippet actions()}
		<Dialog.Root bind:open={dialogOpen}>
			<Dialog.Trigger>
				{#snippet children({ props })}
					<Button {...props}>
						<Plus class="mr-2 size-4" />
						Create Key
					</Button>
				{/snippet}
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Create API Key</Dialog.Title>
					<Dialog.Description>
						Generate a new API key for programmatic access.
					</Dialog.Description>
				</Dialog.Header>
				<div class="flex flex-col gap-4 py-4">
					<div class="flex flex-col gap-2">
						<Label for="key-name">Name</Label>
						<Input
							id="key-name"
							placeholder="e.g. Production Integration"
							bind:value={newKeyName}
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label>Environment</Label>
						<Select.Root
							type="single"
							value={newKeyEnvironment}
							onValueChange={(v) => {
								if (v === "live" || v === "test") newKeyEnvironment = v;
							}}
						>
							<Select.Trigger>
								{newKeyEnvironment === "live" ? "Live" : "Test"}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="test">Test</Select.Item>
								<Select.Item value="live">Live</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div class="flex flex-col gap-2">
						<Label>Permissions</Label>
						<div class="flex flex-col gap-2">
							{#each availablePermissions as perm (perm.key)}
								<label class="flex items-center gap-2 text-sm">
									<Checkbox
										checked={newKeyPermissions[perm.key]}
										onCheckedChange={() => togglePermission(perm.key)}
									/>
									{perm.label}
								</label>
							{/each}
						</div>
					</div>
				</div>
				<Dialog.Footer>
					<Button
						variant="outline"
						onclick={() => {
							dialogOpen = false;
							resetForm();
						}}
					>
						Cancel
					</Button>
					<Button
						onclick={handleCreateKey}
						disabled={isCreating || !newKeyName.trim()}
					>
						{isCreating ? "Creating..." : "Create Key"}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/snippet}
</PageHeader>

<div class="px-6 pb-6">
	{#if apiKeys.length === 0}
		<EmptyState
			icon={Key}
			title="No API keys"
			description="Create an API key to start integrating with the platform programmatically."
			actionLabel="Create Key"
			onaction={() => (dialogOpen = true)}
		/>
	{:else}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Key Prefix</TableHead>
						<TableHead>Environment</TableHead>
						<TableHead>Permissions</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Last Used</TableHead>
						<TableHead>Created</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each apiKeys as apiKey (apiKey._id)}
						<TableRow>
							<TableCell class="font-medium">{apiKey.name}</TableCell>
							<TableCell>
								<code class="text-muted-foreground text-xs">{apiKey.keyPrefix}...</code>
							</TableCell>
							<TableCell>
								<Badge variant={envVariant(apiKey.environment)}>
									{apiKey.environment === "live" ? "Live" : "Test"}
								</Badge>
							</TableCell>
							<TableCell>
								<div class="flex flex-wrap gap-1">
									{#each apiKey.permissions.slice(0, 3) as permission}
										<Badge variant="outline" class="text-xs">{permission}</Badge>
									{/each}
									{#if apiKey.permissions.length > 3}
										<Badge variant="outline" class="text-xs">
											+{apiKey.permissions.length - 3}
										</Badge>
									{/if}
								</div>
							</TableCell>
							<TableCell>
								<Badge variant={statusVariant(apiKey.status)}>
									{apiKey.status.charAt(0).toUpperCase() + apiKey.status.slice(1)}
								</Badge>
							</TableCell>
							<TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
							<TableCell>{formatDate(apiKey._creationTime)}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>
