<script lang="ts">
	import type { Snippet } from "svelte";

	type ThemeConfig = {
		primary?: string;
		primaryForeground?: string;
		secondary?: string;
		secondaryForeground?: string;
		accent?: string;
		accentForeground?: string;
		background?: string;
		foreground?: string;
		card?: string;
		cardForeground?: string;
		muted?: string;
		mutedForeground?: string;
		destructive?: string;
		border?: string;
		input?: string;
		ring?: string;
		radius?: string;
	};

	let {
		theme,
		children,
	}: {
		theme?: ThemeConfig | null;
		children: Snippet;
	} = $props();

	const themeKeyToVar: Record<string, string> = {
		primary: "--primary",
		primaryForeground: "--primary-foreground",
		secondary: "--secondary",
		secondaryForeground: "--secondary-foreground",
		accent: "--accent",
		accentForeground: "--accent-foreground",
		background: "--background",
		foreground: "--foreground",
		card: "--card",
		cardForeground: "--card-foreground",
		muted: "--muted",
		mutedForeground: "--muted-foreground",
		destructive: "--destructive",
		border: "--border",
		input: "--input",
		ring: "--ring",
		radius: "--radius",
	};

	const cssVars = $derived.by(() => {
		if (!theme) return "";
		return Object.entries(theme)
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => {
				const cssVar = themeKeyToVar[key];
				if (!cssVar) return "";
				return `${cssVar}: ${value}`;
			})
			.filter(Boolean)
			.join("; ");
	});
</script>

{#if cssVars}
	<div style={cssVars}>
		{@render children()}
	</div>
{:else}
	{@render children()}
{/if}
