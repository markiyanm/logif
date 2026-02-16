<script lang="ts">
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import StatCard from "$lib/components/dashboard/stat-card.svelte";
	import { Building2, Key, Activity, DollarSign } from "lucide-svelte";
</script>

<PageHeader
	title="Partner Dashboard"
	breadcrumbs={[{ label: "Partner" }, { label: "Dashboard" }]}
/>

<div class="px-6 pb-6">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard
			title="Merchants"
			value="--"
			description="Merchants under your organization"
			icon={Building2}
		/>
		<StatCard
			title="API Keys"
			value="--"
			description="Active API keys"
			icon={Key}
		/>
		<StatCard
			title="API Requests (24h)"
			value="--"
			description="Requests in the last 24 hours"
			icon={Activity}
		/>
		<StatCard
			title="Monthly Volume"
			value="--"
			description="Transaction volume this month"
			icon={DollarSign}
		/>
	</div>
</div>
