import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";
import { ConvexHttpClient } from "convex/browser";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { api } from "$convex/_generated/api.js";

export const load: LayoutServerLoad = async ({ parent }) => {
	const { user, accessToken } = await parent();

	if (!user || !accessToken) {
		throw redirect(302, "/login");
	}

	const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	convex.setAuth(accessToken);

	// Ensure the user exists in Convex (creates on first login)
	const convexUser = await convex.mutation(api.users.ensureCurrentUser);

	if (!convexUser) {
		throw redirect(302, "/login");
	}

	return { convexUser };
};
