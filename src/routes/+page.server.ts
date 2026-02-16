import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.auth?.user;

	if (!user) {
		throw redirect(302, "/login");
	}

	// Will redirect to the appropriate portal based on user role once set up
	// For now, redirect to business portal as default
	throw redirect(302, "/business");
};
