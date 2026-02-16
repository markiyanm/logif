<script lang="ts">
	import { page } from "$app/state";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import AppSidebar from "$lib/components/layout/app-sidebar.svelte";
	import type { NavGroup } from "$lib/components/layout/nav-config.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { toggleMode, mode } from "mode-watcher";
	import {
		LayoutDashboard,
		CreditCard,
		Users,
		ArrowLeftRight,
		BarChart3,
		Palette,
		Settings,
		Key,
		Building2,
		FileText,
		Shield,
		ScrollText,
		Globe,
		Webhook,
		Sun,
		Moon,
	} from "lucide-svelte";

	let { children, data } = $props();

	const adminNav: NavGroup[] = [
		{
			label: "Overview",
			items: [
				{ title: "Dashboard", href: "/admin", icon: LayoutDashboard },
			],
		},
		{
			label: "Management",
			items: [
				{ title: "Merchants", href: "/admin/merchants", icon: Building2 },
				{ title: "Partners", href: "/admin/partners", icon: Globe },
				{ title: "Users", href: "/admin/users", icon: Users },
			],
		},
		{
			label: "Platform",
			items: [
				{ title: "Billing", href: "/admin/billing", icon: FileText },
				{ title: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
				{ title: "System", href: "/admin/system", icon: Settings },
			],
		},
	];

	const partnerNav: NavGroup[] = [
		{
			label: "Overview",
			items: [
				{ title: "Dashboard", href: "/partner", icon: LayoutDashboard },
			],
		},
		{
			label: "Management",
			items: [
				{ title: "Merchants", href: "/partner/merchants", icon: Building2 },
				{ title: "API Keys", href: "/partner/api-keys", icon: Key },
				{ title: "Webhooks", href: "/partner/webhooks", icon: Webhook },
			],
		},
		{
			label: "Resources",
			items: [
				{ title: "Documentation", href: "/partner/docs", icon: FileText },
				{ title: "Billing", href: "/partner/billing", icon: FileText },
			],
		},
	];

	const merchantNav: NavGroup[] = [
		{
			label: "Overview",
			items: [
				{ title: "Dashboard", href: "/business", icon: LayoutDashboard },
			],
		},
		{
			label: "Operations",
			items: [
				{ title: "Gift Cards", href: "/business/cards", icon: CreditCard },
				{
					title: "Transactions",
					href: "/business/transactions",
					icon: ArrowLeftRight,
				},
				{ title: "Customers", href: "/business/customers", icon: Users },
			],
		},
		{
			label: "Settings",
			items: [
				{ title: "Reports", href: "/business/reports", icon: BarChart3 },
				{ title: "Branding", href: "/business/branding", icon: Palette },
				{ title: "API Keys", href: "/business/api-keys", icon: Key },
				{ title: "Settings", href: "/business/settings", icon: Settings },
			],
		},
	];

	// Determine which nav to show based on current path
	const navGroups = $derived.by(() => {
		const pathname = page.url.pathname;
		if (pathname.startsWith("/admin")) return adminNav;
		if (pathname.startsWith("/partner")) return partnerNav;
		return merchantNav;
	});
</script>

<Sidebar.SidebarProvider>
	<AppSidebar {navGroups} user={data.user} />
	<Sidebar.SidebarInset>
		<header class="flex h-12 shrink-0 items-center justify-between border-b px-4">
			<Sidebar.SidebarTrigger />
			<Button variant="ghost" size="icon" onclick={toggleMode}>
				{#if mode.current === "light"}
					<Moon class="size-4" />
				{:else}
					<Sun class="size-4" />
				{/if}
				<span class="sr-only">Toggle dark mode</span>
			</Button>
		</header>
		{@render children()}
	</Sidebar.SidebarInset>
</Sidebar.SidebarProvider>
