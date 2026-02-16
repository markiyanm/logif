<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import type { ComponentType } from "svelte";

	let {
		title,
		value,
		description,
		icon,
		trend,
	}: {
		title: string;
		value: string;
		description?: string;
		icon?: ComponentType;
		trend?: { value: number; label: string };
	} = $props();
</script>

<Card>
	<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
		<CardTitle class="text-sm font-medium">{title}</CardTitle>
		{#if icon}
			<svelte:component this={icon} class="text-muted-foreground size-4" />
		{/if}
	</CardHeader>
	<CardContent>
		<div class="text-2xl font-bold">{value}</div>
		{#if description}
			<p class="text-muted-foreground text-xs">{description}</p>
		{/if}
		{#if trend}
			<p class="text-muted-foreground text-xs">
				<span
					class={trend.value >= 0
						? "text-green-600 dark:text-green-400"
						: "text-red-600 dark:text-red-400"}
				>
					{trend.value >= 0 ? "+" : ""}{trend.value}%
				</span>
				{" "}{trend.label}
			</p>
		{/if}
	</CardContent>
</Card>
