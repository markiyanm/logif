import type { AuthKitAuth, User } from "@workos/authkit-sveltekit";

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			auth: AuthKitAuth;
		}
		interface PageData {
			user: User | null;
		}
	}
}

export {};
