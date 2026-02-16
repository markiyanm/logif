<script lang="ts">
	import PageHeader from "$lib/components/layout/page-header.svelte";
	import ThemeEditor from "$lib/components/branding/theme-editor.svelte";
	import LogoUploader from "$lib/components/branding/logo-uploader.svelte";
	import LoadingState from "$lib/components/shared/loading-state.svelte";
	import { useQuery, useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { toast } from "svelte-sonner";

	const client = useConvexClient();
	let saving = $state(false);

	const merchant = useQuery(api.merchants.getMyMerchant, () => ({}));

	const merchantId = $derived(merchant.data?._id);

	const logoUrl = useQuery(
		api.files.getFileUrl,
		() =>
			merchant.data?.logoStorageId
				? { storageId: merchant.data.logoStorageId }
				: "skip",
	);

	let theme = $state<Record<string, string | undefined>>({});

	$effect(() => {
		if (merchant.data?.theme) {
			theme = { ...merchant.data.theme };
		}
	});

	async function saveTheme() {
		if (!merchantId) return;
		saving = true;
		try {
			await client.mutation(api.merchants.updateBranding, {
				merchantId,
				theme,
			});
			toast.success("Theme saved successfully");
		} catch (err) {
			toast.error("Failed to save theme");
			console.error(err);
		} finally {
			saving = false;
		}
	}

	async function handleLogoUploaded(storageId: string) {
		if (!merchantId) return;
		try {
			await client.mutation(api.merchants.updateBranding, {
				merchantId,
				logoStorageId: storageId as any,
			});
			toast.success("Logo updated successfully");
		} catch (err) {
			toast.error("Failed to update logo");
			console.error(err);
		}
	}
</script>

<PageHeader
	title="Branding"
	description="Customize the look and feel of your customer-facing portal"
	breadcrumbs={[
		{ label: "Business", href: "/business" },
		{ label: "Branding" },
	]}
/>

<div class="space-y-6 px-6 pb-6">
	{#if merchant.isLoading}
		<LoadingState message="Loading branding settings..." />
	{:else}
		<LogoUploader
			currentLogoUrl={logoUrl.data ?? null}
			onuploaded={handleLogoUploaded}
		/>
		<ThemeEditor bind:theme onsave={saveTheme} {saving} />
	{/if}
</div>
