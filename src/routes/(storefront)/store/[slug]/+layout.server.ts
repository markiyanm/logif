import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";
import { ConvexHttpClient } from "convex/browser";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { api } from "$convex/_generated/api.js";

export const load: LayoutServerLoad = async ({ params }) => {
	const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

	const merchant = await convex.query(api.merchants.getPublicProfile, {
		slug: params.slug,
	});

	if (!merchant) {
		throw error(404, "Store not found");
	}

	return { merchant };
};
