<script lang="ts">
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import StatCard from "$lib/components/dashboard/stat-card.svelte";
	import { useQuery } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { Building2, Globe, Users, DollarSign } from "lucide-svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";

	const merchantsQuery = useQuery(api.merchants.list, { limit: 1 });
	const usersQuery = useQuery(api.users.listUsers, {
		paginationOpts: { numItems: 1, cursor: null },
	});
</script>

<PageHeader
	title="Admin Dashboard"
	breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
/>

<div class="px-6 pb-6">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard
			title="Total Merchants"
			value={merchantsQuery.data ? String(merchantsQuery.data.page.length) : "--"}
			description="Active merchants on the platform"
			icon={Building2}
		/>
		<StatCard
			title="Total Partners"
			value="--"
			description="Registered partner organizations"
			icon={Globe}
		/>
		<StatCard
			title="Total Users"
			value={usersQuery.data ? String(usersQuery.data.page.length) : "--"}
			description="Registered user accounts"
			icon={Users}
		/>
		<StatCard
			title="Platform Volume"
			value="--"
			description="Total transaction volume"
			icon={DollarSign}
		/>
	</div>
</div>
