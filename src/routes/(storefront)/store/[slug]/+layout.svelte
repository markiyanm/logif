<script lang="ts">
	let { children, data } = $props();

	const { merchant } = data;

	/**
	 * Convert camelCase theme keys to kebab-case CSS custom properties.
	 * e.g. "primaryForeground" -> "--primary-foreground"
	 */
	function toKebabCase(str: string): string {
		return str.replace(/([A-Z])/g, "-$1").toLowerCase();
	}

	const themeStyle = $derived.by(() => {
		if (!merchant.theme) return "";
		return Object.entries(merchant.theme)
			.filter(([, value]) => value != null)
			.map(([key, value]) => `--${toKebabCase(key)}: ${value}`)
			.join("; ");
	});
</script>

<div class="bg-background text-foreground min-h-screen" style={themeStyle}>
	<header class="border-b">
		<div class="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
			{#if merchant.logoStorageId}
				<img
					src="/api/storage/{merchant.logoStorageId}"
					alt="{merchant.name} logo"
					class="h-10 w-10 rounded-md object-contain"
				/>
			{/if}
			<div>
				<h1 class="text-xl font-bold">{merchant.name}</h1>
				{#if merchant.description}
					<p class="text-muted-foreground text-sm">{merchant.description}</p>
				{/if}
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-2xl px-4 py-8">
		{@render children()}
	</main>
</div>
