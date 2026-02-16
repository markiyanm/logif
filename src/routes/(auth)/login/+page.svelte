<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card/index.js";

	let { data } = $props();
</script>

<div class="flex min-h-screen items-center justify-center">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			<CardTitle class="text-2xl font-bold">Welcome to Logif</CardTitle>
			<CardDescription>
				Gift card & loyalty platform
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-col gap-3">
			<Button href={data.signInUrl} class="w-full">Sign In</Button>
			<Button href={data.signUpUrl} variant="outline" class="w-full">
				Create Account
			</Button>
		</CardContent>
	</Card>
</div>
