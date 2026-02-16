<script lang="ts">
	type ThemeConfig = Record<string, string | undefined>;

	type Preset = {
		name: string;
		description: string;
		theme: ThemeConfig;
	};

	let {
		onselect,
	}: {
		onselect: (theme: ThemeConfig) => void;
	} = $props();

	const presets: Preset[] = [
		{
			name: "Qrafthive",
			description: "Warm terracotta + teal",
			theme: {
				background: "#faf5f0",
				foreground: "#1a1a1a",
				card: "#ffffff",
				cardForeground: "#1a1a1a",
				primary: "#c75c2a",
				primaryForeground: "#ffffff",
				secondary: "#f0e6d8",
				secondaryForeground: "#1a1a1a",
				accent: "#1a8a7a",
				accentForeground: "#ffffff",
				muted: "#f0e6d8",
				mutedForeground: "#6b5e50",
				destructive: "#dc2626",
				border: "#e0d5c8",
				input: "#e0d5c8",
				ring: "#c75c2a",
				radius: "0.625rem",
			},
		},
		{
			name: "AstroVista",
			description: "Burnt orange + navy blue",
			theme: {
				background: "#0f172a",
				foreground: "#e2e8f0",
				card: "#1e293b",
				cardForeground: "#e2e8f0",
				primary: "#ea6a2e",
				primaryForeground: "#ffffff",
				secondary: "#334155",
				secondaryForeground: "#e2e8f0",
				accent: "#3b82f6",
				accentForeground: "#ffffff",
				muted: "#334155",
				mutedForeground: "#94a3b8",
				destructive: "#ef4444",
				border: "#334155",
				input: "#334155",
				ring: "#ea6a2e",
				radius: "0.5rem",
			},
		},
		{
			name: "Purples",
			description: "Monochromatic violet",
			theme: {
				background: "#faf8ff",
				foreground: "#1a1035",
				card: "#ffffff",
				cardForeground: "#1a1035",
				primary: "#7c3aed",
				primaryForeground: "#ffffff",
				secondary: "#ede9fe",
				secondaryForeground: "#1a1035",
				accent: "#a78bfa",
				accentForeground: "#ffffff",
				muted: "#ede9fe",
				mutedForeground: "#6b5f85",
				destructive: "#dc2626",
				border: "#ddd6fe",
				input: "#ddd6fe",
				ring: "#7c3aed",
				radius: "0.75rem",
			},
		},
		{
			name: "Blue Yellow",
			description: "Golden yellow + cyan",
			theme: {
				background: "#f8fafc",
				foreground: "#0c1929",
				card: "#ffffff",
				cardForeground: "#0c1929",
				primary: "#eab308",
				primaryForeground: "#0c1929",
				secondary: "#e0f2fe",
				secondaryForeground: "#0c1929",
				accent: "#06b6d4",
				accentForeground: "#ffffff",
				muted: "#f1f5f9",
				mutedForeground: "#64748b",
				destructive: "#ef4444",
				border: "#e2e8f0",
				input: "#e2e8f0",
				ring: "#eab308",
				radius: "0.5rem",
			},
		},
		{
			name: "Dark Forge",
			description: "Amber/bronze, warm parchment",
			theme: {
				background: "#1c1917",
				foreground: "#faf5ef",
				card: "#292524",
				cardForeground: "#faf5ef",
				primary: "#d97706",
				primaryForeground: "#1c1917",
				secondary: "#44403c",
				secondaryForeground: "#faf5ef",
				accent: "#b45309",
				accentForeground: "#faf5ef",
				muted: "#44403c",
				mutedForeground: "#a8a29e",
				destructive: "#dc2626",
				border: "#44403c",
				input: "#44403c",
				ring: "#d97706",
				radius: "0.5rem",
			},
		},
	];
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
	{#each presets as preset}
		<button
			type="button"
			class="border-border hover:border-primary/50 hover:bg-accent/10 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
			onclick={() => onselect(preset.theme)}
		>
			<div>
				<p class="text-sm font-medium">{preset.name}</p>
				<p class="text-muted-foreground text-xs">{preset.description}</p>
			</div>
			<div class="flex gap-1">
				{#each ["primary", "secondary", "accent", "background", "foreground"] as key}
					{#if preset.theme[key]}
						<span
							class="size-5 rounded-full border"
							style="background-color: {preset.theme[key]}"
						></span>
					{/if}
				{/each}
			</div>
		</button>
	{/each}
</div>
