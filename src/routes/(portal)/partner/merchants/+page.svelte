<script lang="ts">
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import { useQuery } from "convex-svelte";
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
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import EmptyState from "$lib/components/shared/empty-state.svelte";
	import { Building2 } from "lucide-svelte";

	const merchantsQuery = useQuery(api.merchants.list, { limit: 50 });

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}

	function statusVariant(status: string) {
		switch (status) {
			case "active":
				return "default" as const;
			case "suspended":
				return "destructive" as const;
			case "pending":
				return "secondary" as const;
			default:
				return "outline" as const;
		}
	}
</script>

<PageHeader
	title="Merchants"
	breadcrumbs={[
		{ label: "Partner", href: "/partner" },
		{ label: "Merchants" },
	]}
/>

<div class="px-6 pb-6">
	{#if merchantsQuery.isLoading}
		<LoadingState message="Loading merchants..." />
	{:else if merchantsQuery.data && merchantsQuery.data.page.length === 0}
		<EmptyState
			icon={Building2}
			title="No merchants yet"
			description="Merchants assigned to your organization will appear here."
		/>
	{:else if merchantsQuery.data}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Slug</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Contact Email</TableHead>
						<TableHead>Created</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each merchantsQuery.data.page as merchant (merchant._id)}
						<TableRow>
							<TableCell class="font-medium">{merchant.name}</TableCell>
							<TableCell>
								<code class="text-muted-foreground text-xs">{merchant.slug}</code>
							</TableCell>
							<TableCell>
								<Badge variant={statusVariant(merchant.status)}>
									{merchant.status.charAt(0).toUpperCase() + merchant.status.slice(1)}
								</Badge>
							</TableCell>
							<TableCell>{merchant.contactEmail}</TableCell>
							<TableCell>{formatDate(merchant._creationTime)}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>
