<script lang="ts">
	import { page } from "$app/state";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";

	const errorMessages: Record<string, string> = {
		ACCESS_DENIED: "Access was denied. Please try again or contact support.",
		AUTH_ERROR: "An authentication error occurred. Please try again.",
		AUTH_FAILED: "Authentication failed. Please try again.",
		DEFAULT: "An error occurred during authentication.",
	};

	const errorCode = $derived(
		page.url.searchParams.get("code") || "DEFAULT",
	);
	const errorMessage = $derived(
		errorMessages[errorCode] || errorMessages.DEFAULT,
	);
</script>

<div class="flex min-h-screen items-center justify-center">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl font-bold">
				Authentication Error
			</CardTitle>
			<CardDescription>{errorMessage}</CardDescription>
		</CardHeader>
		<CardContent class="flex justify-center">
			<Button href="/login">Try Again</Button>
		</CardContent>
	</Card>
</div>
