<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import type { ComponentType, Snippet } from "svelte";

	let {
		icon,
		title,
		description,
		actionLabel,
		actionHref,
		onaction,
		children,
	}: {
		icon?: ComponentType;
		title: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onaction?: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	{#if icon}
		<div class="bg-muted mb-4 rounded-full p-3">
			<svelte:component this={icon} class="text-muted-foreground size-6" />
		</div>
	{/if}
	<h3 class="text-lg font-semibold">{title}</h3>
	{#if description}
		<p class="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
	{/if}
	{#if actionLabel}
		<div class="mt-4">
			{#if actionHref}
				<Button href={actionHref}>{actionLabel}</Button>
			{:else if onaction}
				<Button onclick={onaction}>{actionLabel}</Button>
			{/if}
		</div>
	{/if}
	{#if children}
		<div class="mt-4">
			{@render children()}
		</div>
	{/if}
</div>
