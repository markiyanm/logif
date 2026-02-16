<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import { Code } from "lucide-svelte";
	import { toast } from "svelte-sonner";

	type ThemeConfig = Record<string, string | undefined>;

	let {
		theme,
		onimport,
	}: {
		theme: ThemeConfig;
		onimport: (theme: ThemeConfig) => void;
	} = $props();

	let open = $state(false);
	let importCss = $state("");

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

	const varToThemeKey: Record<string, string> = Object.fromEntries(
		Object.entries(themeKeyToVar).map(([k, v]) => [v, k]),
	);

	const cssOutput = $derived.by(() => {
		const lines = Object.entries(theme)
			.filter(([, value]) => value !== undefined && value !== "")
			.map(([key, value]) => {
				const cssVar = themeKeyToVar[key];
				if (!cssVar) return "";
				return `  ${cssVar}: ${value};`;
			})
			.filter(Boolean);

		if (lines.length === 0) return "/* No theme values set */";
		return `:root {\n${lines.join("\n")}\n}`;
	});

	function handleImport() {
		const parsed: ThemeConfig = {};
		const pattern = /--([\w-]+)\s*:\s*([^;]+);/g;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(importCss)) !== null) {
			const cssVar = `--${match[1]}`;
			const value = match[2].trim();
			const themeKey = varToThemeKey[cssVar];
			if (themeKey) {
				parsed[themeKey] = value;
			}
		}

		const keys = Object.keys(parsed);
		if (keys.length === 0) {
			toast.error("No valid theme variables found in the CSS");
			return;
		}

		onimport(parsed);
		importCss = "";
		open = false;
		toast.success(`Imported ${keys.length} theme values`);
	}

	function handleCopy() {
		navigator.clipboard.writeText(cssOutput);
		toast.success("CSS copied to clipboard");
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button variant="outline" {...props}>
				<Code class="mr-2 size-4" />
				Theme Code
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Theme Code</Dialog.Title>
			<Dialog.Description>
				View your current theme as CSS or import CSS from tweakcn.com
			</Dialog.Description>
		</Dialog.Header>

		<Tabs.Root value="view">
			<Tabs.List class="w-full">
				<Tabs.Trigger value="view" class="flex-1">View CSS</Tabs.Trigger>
				<Tabs.Trigger value="import" class="flex-1">Import CSS</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="view" class="mt-4">
				<div class="relative">
					<pre
						class="bg-muted max-h-[400px] overflow-auto rounded-lg p-4 text-sm">{cssOutput}</pre>
					<Button
						variant="outline"
						size="sm"
						class="absolute right-2 top-2"
						onclick={handleCopy}
					>
						Copy
					</Button>
				</div>
			</Tabs.Content>

			<Tabs.Content value="import" class="mt-4">
				<p class="text-muted-foreground mb-3 text-sm">
					Paste CSS custom properties from tweakcn.com or any CSS theme.
					Variables like <code class="text-foreground">--primary: #7c3aed;</code>
					will be mapped to theme fields.
				</p>
				<textarea
					class="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border p-3 font-mono text-sm"
					rows="12"
					placeholder={`:root {\n  --primary: #7c3aed;\n  --background: #ffffff;\n  /* ... */\n}`}
					bind:value={importCss}
				></textarea>
				<div class="mt-3 flex justify-end">
					<Button onclick={handleImport} disabled={!importCss.trim()}>
						Import & Apply
					</Button>
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</Dialog.Content>
</Dialog.Root>
