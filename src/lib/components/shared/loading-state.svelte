<script lang="ts">
	import { Spinner } from "$lib/components/ui/spinner/index.js";

	let { message = "Loading..." }: { message?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center py-12">
	<Spinner size="lg" />
	<p class="text-muted-foreground mt-3 text-sm">{message}</p>
</div>
