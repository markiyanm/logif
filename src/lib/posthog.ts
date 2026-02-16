import posthog from "posthog-js";
import { browser } from "$app/environment";

let posthogInitialized = false;

export function initPostHog(key: string, host: string) {
	if (!browser || posthogInitialized || !key) return;

	posthog.init(key, {
		api_host: host,
		capture_pageview: false, // we handle this manually on SPA navigation
		capture_pageleave: true,
		persistence: "localStorage+cookie",
	});

	posthogInitialized = true;
}

export function capturePageView(url: string) {
	if (!browser || !posthogInitialized) return;
	posthog.capture("$pageview", {
		$current_url: url,
	});
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
	if (!browser || !posthogInitialized) return;
	posthog.identify(userId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
	if (!browser || !posthogInitialized) return;
	posthog.capture(event, properties);
}

export function resetPostHog() {
	if (!browser || !posthogInitialized) return;
	posthog.reset();
}

export { posthog };
