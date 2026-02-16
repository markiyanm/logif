<script lang="ts">
	import "../app.css";
	import { setupConvex, useConvexClient } from "convex-svelte";
	import { PUBLIC_CONVEX_URL } from "$env/static/public";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import { ModeWatcher } from "mode-watcher";
	import { page } from "$app/state";
	import { browser } from "$app/environment";
	import {
		initPostHog,
		capturePageView,
		identifyUser,
	} from "$lib/posthog.js";
	import {
		PUBLIC_POSTHOG_KEY,
		PUBLIC_POSTHOG_HOST,
	} from "$env/static/public";

	let { children, data } = $props();

	setupConvex(PUBLIC_CONVEX_URL);

	const client = useConvexClient();

	// Initialize PostHog
	if (browser) {
		initPostHog(PUBLIC_POSTHOG_KEY, PUBLIC_POSTHOG_HOST);
	}

	// Track page views on navigation
	$effect(() => {
		if (browser) {
			capturePageView(page.url.href);
		}
	});

	// Set up Convex auth and identify user in PostHog
	$effect(() => {
		if (data.accessToken) {
			client.setAuth(
				async () => data.accessToken ?? null,
				(isAuthenticated) => {
					if (!isAuthenticated) {
						console.debug("Convex auth: not authenticated");
					}
				},
			);
		}

		if (data.user && browser) {
			identifyUser(data.user.id, {
				email: data.user.email,
				name: `${data.user.firstName ?? ""} ${data.user.lastName ?? ""}`.trim(),
			});
		}
	});
</script>

<svelte:head>
	<meta name="description" content="Logif - Gift Card & Loyalty Platform" />
</svelte:head>

<ModeWatcher defaultMode="dark" />
{@render children()}
<Toaster />
