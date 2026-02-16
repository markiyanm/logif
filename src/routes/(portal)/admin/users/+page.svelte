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
	import { Users } from "lucide-svelte";

	const usersQuery = useQuery(api.users.listUsers, {
		paginationOpts: { numItems: 50, cursor: null },
	});

	function formatDate(timestamp: number | undefined): string {
		if (!timestamp) return "Never";
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	function roleVariant(role: string) {
		switch (role) {
			case "admin":
				return "destructive" as const;
			case "partner":
				return "default" as const;
			case "merchant":
				return "secondary" as const;
			case "customer":
				return "outline" as const;
			default:
				return "outline" as const;
		}
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
	title="Users"
	breadcrumbs={[
		{ label: "Admin", href: "/admin" },
		{ label: "Users" },
	]}
/>

<div class="px-6 pb-6">
	{#if usersQuery.isLoading}
		<LoadingState message="Loading users..." />
	{:else if usersQuery.data && usersQuery.data.page.length === 0}
		<EmptyState
			icon={Users}
			title="No users yet"
			description="Users will appear here once they register."
		/>
	{:else if usersQuery.data}
		<div class="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Last Login</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each usersQuery.data.page as user (user._id)}
						<TableRow>
							<TableCell class="font-medium">{user.name}</TableCell>
							<TableCell>{user.email}</TableCell>
							<TableCell>
								<Badge variant={roleVariant(user.role)}>
									{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
								</Badge>
							</TableCell>
							<TableCell>
								<Badge variant={statusVariant(user.status)}>
									{user.status.charAt(0).toUpperCase() + user.status.slice(1)}
								</Badge>
							</TableCell>
							<TableCell>{formatDate(user.lastLoginAt)}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	{/if}
</div>
