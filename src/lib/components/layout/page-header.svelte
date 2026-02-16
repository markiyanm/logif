<script lang="ts">
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { SidebarTrigger } from "$lib/components/ui/sidebar/index.js";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import type { Snippet } from "svelte";

	let {
		title,
		description,
		breadcrumbs = [],
		actions,
	}: {
		title: string;
		description?: string;
		breadcrumbs?: { label: string; href?: string }[];
		actions?: Snippet;
	} = $props();
</script>

<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
	<SidebarTrigger class="-ml-1" />
	<Separator orientation="vertical" class="mr-2 h-4" />
	{#if breadcrumbs.length > 0}
		<Breadcrumb.Root>
			<Breadcrumb.List>
				{#each breadcrumbs as crumb, i}
					{#if i > 0}
						<Breadcrumb.Separator />
					{/if}
					<Breadcrumb.Item>
						{#if crumb.href && i < breadcrumbs.length - 1}
							<Breadcrumb.Link href={crumb.href}>
								{crumb.label}
							</Breadcrumb.Link>
						{:else}
							<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
						{/if}
					</Breadcrumb.Item>
				{/each}
			</Breadcrumb.List>
		</Breadcrumb.Root>
	{/if}
</header>

<div class="flex items-center justify-between px-6 py-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{title}</h1>
		{#if description}
			<p class="text-muted-foreground text-sm">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
