import { configureAuthKit, authKitHandle } from "@workos/authkit-sveltekit";
import { env } from "$env/dynamic/private";
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

configureAuthKit({
	clientId: env.WORKOS_CLIENT_ID!,
	apiKey: env.WORKOS_API_KEY!,
	redirectUri: env.WORKOS_REDIRECT_URI!,
	cookiePassword: env.WORKOS_COOKIE_PASSWORD!,
});

const authHandle = authKitHandle();

const protectedRoutesHandle: Handle = async ({ event, resolve }) => {
	const protectedPaths = ["/admin", "/partner", "/business"] as const;
	const isProtectedRoute = protectedPaths.some((path) =>
		event.url.pathname.startsWith(path),
	);

	if (isProtectedRoute && !event.locals.auth?.user) {
		const returnPath = event.url.pathname + event.url.search;
		throw redirect(
			302,
			`/login?returnPathname=${encodeURIComponent(returnPath)}`,
		);
	}

	return resolve(event);
};

export const handle = sequence(authHandle, protectedRoutesHandle);
