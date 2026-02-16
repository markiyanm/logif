import { authKit } from "@workos/authkit-sveltekit";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async (event) => {
	if (event.locals.auth?.user) {
		throw redirect(302, "/");
	}

	const returnPathname =
		event.url.searchParams.get("returnPathname") || "/";

	const signUpUrl = await authKit.getSignUpUrl({
		returnTo: returnPathname,
	});
	throw redirect(302, signUpUrl);
};
