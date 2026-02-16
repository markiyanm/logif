<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";
	import { Upload, X } from "lucide-svelte";
	import { useConvexClient } from "convex-svelte";
	import { api } from "$convex/_generated/api.js";
	import { toast } from "svelte-sonner";

	let {
		currentLogoUrl,
		onuploaded,
	}: {
		currentLogoUrl?: string | null;
		onuploaded: (storageId: string) => void;
	} = $props();

	const client = useConvexClient();
	let uploading = $state(false);
	let dragOver = $state(false);

	async function handleFile(file: File) {
		if (!file.type.startsWith("image/")) {
			toast.error("Please upload an image file");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			toast.error("File size must be under 5MB");
			return;
		}

		uploading = true;
		try {
			const uploadUrl = await client.mutation(
				api.files.generateUploadUrl,
			);
			const response = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});
			const { storageId } = await response.json();
			onuploaded(storageId);
			toast.success("Logo uploaded successfully");
		} catch (err) {
			toast.error("Failed to upload logo");
			console.error(err);
		} finally {
			uploading = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Logo</CardTitle>
		<CardDescription>
			Upload your business logo (PNG, JPG, SVG - max 5MB)
		</CardDescription>
	</CardHeader>
	<CardContent>
		{#if currentLogoUrl}
			<div class="mb-4 flex items-center gap-4">
				<img
					src={currentLogoUrl}
					alt="Current logo"
					class="h-16 w-16 rounded-lg border object-contain"
				/>
				<p class="text-muted-foreground text-sm">Current logo</p>
			</div>
		{/if}

		<div
			class="border-muted-foreground/25 hover:border-muted-foreground/50 relative flex min-h-[120px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors {dragOver ? 'border-primary bg-primary/5' : ''}"
			role="button"
			tabindex="0"
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={handleDrop}
			onclick={() =>
				document.getElementById("logo-file-input")?.click()}
			onkeydown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					document.getElementById("logo-file-input")?.click();
				}
			}}
		>
			<input
				id="logo-file-input"
				type="file"
				accept="image/*"
				class="hidden"
				oninput={handleInput}
			/>
			<div class="flex flex-col items-center gap-2 text-center">
				<Upload class="text-muted-foreground size-8" />
				<p class="text-muted-foreground text-sm">
					{uploading
						? "Uploading..."
						: "Drag & drop or click to upload"}
				</p>
			</div>
		</div>
	</CardContent>
</Card>
