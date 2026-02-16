<script lang="ts">
	import { page } from "$app/state";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { NavGroup } from "./nav-config.js";
	import type { User } from "@workos/authkit-sveltekit";
	import { resetPostHog } from "$lib/posthog.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import {
		ChevronsUpDown,
		LogOut,
		Settings,
	} from "lucide-svelte";

	let {
		navGroups,
		user,
		title = "Logif",
	}: {
		navGroups: NavGroup[];
		user: User | null;
		title?: string;
	} = $props();

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + "/");
	}
</script>

<Sidebar.Sidebar collapsible="icon">
	<Sidebar.SidebarHeader>
		<Sidebar.SidebarMenu>
			<Sidebar.SidebarMenuItem>
				<Sidebar.SidebarMenuButton size="lg">
					<div
						class="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-sm font-bold"
					>
						L
					</div>
					<div class="grid flex-1 text-left text-sm leading-tight">
						<span class="truncate font-semibold">{title}</span>
						<span class="text-muted-foreground truncate text-xs">
							Gift & Loyalty Platform
						</span>
					</div>
				</Sidebar.SidebarMenuButton>
			</Sidebar.SidebarMenuItem>
		</Sidebar.SidebarMenu>
	</Sidebar.SidebarHeader>

	<Sidebar.SidebarContent>
		{#each navGroups as group}
			<Sidebar.SidebarGroup>
				<Sidebar.SidebarGroupLabel>{group.label}</Sidebar.SidebarGroupLabel>
				<Sidebar.SidebarGroupContent>
					<Sidebar.SidebarMenu>
						{#each group.items as item}
							<Sidebar.SidebarMenuItem>
								<Sidebar.SidebarMenuButton
									href={item.href}
									isActive={isActive(item.href)}
									tooltip={item.title}
								>
									<item.icon />
									<span>{item.title}</span>
									{#if item.badge}
										<Sidebar.SidebarMenuBadge>
											{item.badge}
										</Sidebar.SidebarMenuBadge>
									{/if}
								</Sidebar.SidebarMenuButton>
							</Sidebar.SidebarMenuItem>
						{/each}
					</Sidebar.SidebarMenu>
				</Sidebar.SidebarGroupContent>
			</Sidebar.SidebarGroup>
		{/each}
	</Sidebar.SidebarContent>

	<Sidebar.SidebarFooter>
		<Sidebar.SidebarMenu>
			<Sidebar.SidebarMenuItem>
				{#if user}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.SidebarMenuButton
									{...props}
									size="lg"
									class="data-[state=open]:bg-sidebar-accent"
								>
									<Avatar.Root class="size-8 rounded-lg">
										{#if user.profilePictureUrl}
											<Avatar.Image
												src={user.profilePictureUrl}
												alt={user.firstName ?? ""}
											/>
										{/if}
										<Avatar.Fallback class="rounded-lg">
											{(user.firstName?.[0] ?? "")}{(user.lastName?.[0] ?? "")}
										</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate font-semibold">
											{user.firstName} {user.lastName}
										</span>
										<span class="text-muted-foreground truncate text-xs">
											{user.email}
										</span>
									</div>
									<ChevronsUpDown class="ml-auto size-4" />
								</Sidebar.SidebarMenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="w-[--bits-dropdown-menu-anchor-width] min-w-56"
							side="bottom"
							align="end"
						>
							<DropdownMenu.Label class="p-0 font-normal">
								<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar.Root class="size-8 rounded-lg">
										{#if user.profilePictureUrl}
											<Avatar.Image
												src={user.profilePictureUrl}
												alt={user.firstName ?? ""}
											/>
										{/if}
										<Avatar.Fallback class="rounded-lg">
											{(user.firstName?.[0] ?? "")}{(user.lastName?.[0] ?? "")}
										</Avatar.Fallback>
									</Avatar.Root>
									<div class="grid flex-1 text-left text-sm leading-tight">
										<span class="truncate font-semibold">
											{user.firstName} {user.lastName}
										</span>
										<span class="text-muted-foreground truncate text-xs">
											{user.email}
										</span>
									</div>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item href="/settings">
								<Settings class="mr-2 size-4" />
								Settings
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onclick={() => {
									resetPostHog();
									const form = document.createElement("form");
									form.method = "POST";
									form.action = "/logout";
									document.body.appendChild(form);
									form.submit();
								}}
							>
								<LogOut class="mr-2 size-4" />
								Sign Out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
			</Sidebar.SidebarMenuItem>
		</Sidebar.SidebarMenu>
	</Sidebar.SidebarFooter>

	<Sidebar.SidebarRail />
</Sidebar.Sidebar>
