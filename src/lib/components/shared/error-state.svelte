<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { AlertCircle } from "lucide-svelte";

	let {
		title = "Something went wrong",
		message,
		onretry,
	}: {
		title?: string;
		message?: string;
		onretry?: () => void;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	<div class="bg-destructive/10 mb-4 rounded-full p-3">
		<AlertCircle class="text-destructive size-6" />
	</div>
	<h3 class="text-lg font-semibold">{title}</h3>
	{#if message}
		<p class="text-muted-foreground mt-1 max-w-sm text-sm">{message}</p>
	{/if}
	{#if onretry}
		<Button variant="outline" class="mt-4" onclick={onretry}>
			Try Again
		</Button>
	{/if}
</div>
