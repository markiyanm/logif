<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import ThemeProvider from "./theme-provider.svelte";
	import ThemePresets from "./theme-presets.svelte";
	import ThemeCodeDialog from "./theme-code-dialog.svelte";

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
		theme = $bindable({}),
		onsave,
		saving = false,
	}: {
		theme: ThemeConfig;
		onsave?: () => void;
		saving?: boolean;
	} = $props();

	const colorFields: { key: keyof ThemeConfig; label: string }[] = [
		{ key: "primary", label: "Primary" },
		{ key: "primaryForeground", label: "Primary Foreground" },
		{ key: "secondary", label: "Secondary" },
		{ key: "secondaryForeground", label: "Secondary Foreground" },
		{ key: "accent", label: "Accent" },
		{ key: "accentForeground", label: "Accent Foreground" },
		{ key: "background", label: "Background" },
		{ key: "foreground", label: "Foreground" },
		{ key: "card", label: "Card" },
		{ key: "cardForeground", label: "Card Foreground" },
		{ key: "muted", label: "Muted" },
		{ key: "mutedForeground", label: "Muted Foreground" },
		{ key: "destructive", label: "Destructive" },
		{ key: "border", label: "Border" },
		{ key: "input", label: "Input" },
		{ key: "ring", label: "Ring" },
	];
</script>

<Card class="mb-6">
	<CardHeader>
		<CardTitle>Theme Presets</CardTitle>
		<CardDescription>
			Quick-start with a preset theme, then customize below
		</CardDescription>
	</CardHeader>
	<CardContent>
		<ThemePresets
			onselect={(preset) => {
				theme = { ...preset };
			}}
		/>
	</CardContent>
</Card>

<div class="grid gap-6 lg:grid-cols-2">
	<Card>
		<CardHeader>
			<CardTitle>Theme Colors</CardTitle>
			<CardDescription>
				Set colors using hex or OKLCH values
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each colorFields as field}
					<div class="space-y-1.5">
						<Label for={field.key}>{field.label}</Label>
						<Input
							id={field.key}
							placeholder="#7c3aed"
							value={theme[field.key] ?? ""}
							oninput={(e) => {
								theme = {
									...theme,
									[field.key]: (e.target as HTMLInputElement).value || undefined,
								};
							}}
						/>
					</div>
				{/each}

				<div class="space-y-1.5">
					<Label for="radius">Border Radius</Label>
					<Input
						id="radius"
						placeholder="0.625rem"
						value={theme.radius ?? ""}
						oninput={(e) => {
							theme = {
								...theme,
								radius: (e.target as HTMLInputElement).value || undefined,
							};
						}}
					/>
				</div>
			</div>

			<div class="mt-6 flex gap-2">
				{#if onsave}
					<Button onclick={onsave} disabled={saving}>
						{saving ? "Saving..." : "Save Theme"}
					</Button>
				{/if}
				<ThemeCodeDialog
					{theme}
					onimport={(imported) => {
						theme = { ...imported };
					}}
				/>
			</div>
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<CardTitle>Preview</CardTitle>
			<CardDescription>
				Live preview of your theme changes
			</CardDescription>
		</CardHeader>
		<CardContent>
			<ThemeProvider {theme}>
				<div class="bg-background text-foreground rounded-lg border p-6">
					<h3 class="text-foreground mb-2 text-lg font-bold">
						Sample Store
					</h3>
					<p class="text-muted-foreground mb-4 text-sm">
						This is how your customer portal will look.
					</p>

					<div class="bg-card text-card-foreground mb-4 rounded-lg border p-4">
						<p class="mb-1 text-sm font-medium">Gift Card Balance</p>
						<p class="text-2xl font-bold">$50.00</p>
					</div>

					<div class="flex gap-2">
						<Button size="sm">Check Balance</Button>
						<Button size="sm" variant="secondary">
							View History
						</Button>
						<Button size="sm" variant="outline">
							Contact
						</Button>
					</div>

					<div class="bg-muted mt-4 rounded-md p-3">
						<p class="text-muted-foreground text-xs">
							Muted background area for notices and info.
						</p>
					</div>
				</div>
			</ThemeProvider>
		</CardContent>
	</Card>
</div>
