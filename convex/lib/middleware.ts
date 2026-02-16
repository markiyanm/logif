import {
	QueryCtx,
	MutationCtx,
	ActionCtx,
} from "../_generated/server.js";
import { Doc, Id } from "../_generated/dataModel.js";
import { unauthorized, forbidden, notFound } from "./errors.js";
import type { ApiPermission } from "./constants.js";
import { hasPermission } from "./permissions.js";
import { sha256 } from "./crypto.js";

export type AuthenticatedUser = Doc<"users">;

export interface AuthContext {
	user: AuthenticatedUser;
}

export interface MerchantContext extends AuthContext {
	merchant: Doc<"merchants">;
	memberRole: "owner" | "admin" | "staff";
}

export interface PartnerContext extends AuthContext {
	partner: Doc<"partners">;
	memberRole: "owner" | "admin" | "member";
}

export interface ApiKeyContext {
	apiKey: Doc<"apiKeys">;
	merchantId: Id<"merchants"> | undefined;
	partnerId: Id<"partners"> | undefined;
}

// ─── Auth Helpers ──────────────────────────────────────────────────

export async function getAuthenticatedUser(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthenticatedUser> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		unauthorized();
	}

	const user = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();

	if (!user) {
		unauthorized("User account not found. Please complete registration.");
	}

	if (user.status === "suspended") {
		forbidden("Your account has been suspended");
	}

	return user;
}

export async function withAuth(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthContext> {
	const user = await getAuthenticatedUser(ctx);
	return { user };
}

export async function withAdmin(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthContext> {
	const user = await getAuthenticatedUser(ctx);
	if (user.role !== "admin") {
		forbidden("Admin access required");
	}
	return { user };
}

export async function withMerchant(
	ctx: QueryCtx | MutationCtx,
	merchantId: Id<"merchants">,
): Promise<MerchantContext> {
	const user = await getAuthenticatedUser(ctx);

	const merchant = await ctx.db.get(merchantId);
	if (!merchant) {
		notFound("Merchant");
	}

	// Admin can access any merchant
	if (user.role === "admin") {
		return { user, merchant, memberRole: "owner" };
	}

	const membership = await ctx.db
		.query("merchantMembers")
		.withIndex("by_merchantId_and_userId", (q) =>
			q.eq("merchantId", merchantId).eq("userId", user._id),
		)
		.unique();

	if (!membership) {
		// Check if partner has access
		if (merchant.partnerId) {
			const partnerMembership = await ctx.db
				.query("partnerMembers")
				.withIndex("by_partnerId_and_userId", (q) =>
					q.eq("partnerId", merchant.partnerId!).eq("userId", user._id),
				)
				.unique();

			if (partnerMembership) {
				return { user, merchant, memberRole: "admin" };
			}
		}

		forbidden("You do not have access to this merchant");
	}

	return { user, merchant, memberRole: membership.role };
}

export async function withPartner(
	ctx: QueryCtx | MutationCtx,
	partnerId: Id<"partners">,
): Promise<PartnerContext> {
	const user = await getAuthenticatedUser(ctx);

	const partner = await ctx.db.get(partnerId);
	if (!partner) {
		notFound("Partner");
	}

	// Admin can access any partner
	if (user.role === "admin") {
		return { user, partner, memberRole: "owner" };
	}

	const membership = await ctx.db
		.query("partnerMembers")
		.withIndex("by_partnerId_and_userId", (q) =>
			q.eq("partnerId", partnerId).eq("userId", user._id),
		)
		.unique();

	if (!membership) {
		forbidden("You do not have access to this partner organization");
	}

	return { user, partner, memberRole: membership.role };
}

export async function withApiKey(
	ctx: QueryCtx | MutationCtx,
	apiKeyString: string,
): Promise<ApiKeyContext> {
	const keyHash = await sha256(apiKeyString);

	const apiKey = await ctx.db
		.query("apiKeys")
		.withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
		.unique();

	if (!apiKey) {
		unauthorized("Invalid API key");
	}

	if (apiKey.status === "revoked") {
		unauthorized("API key has been revoked");
	}

	if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
		unauthorized("API key has expired");
	}

	return {
		apiKey,
		merchantId: apiKey.merchantId,
		partnerId: apiKey.partnerId,
	};
}

export function requirePermission(
	apiKey: Doc<"apiKeys">,
	permission: ApiPermission,
): void {
	if (!hasPermission(apiKey.permissions, permission)) {
		forbidden(`API key missing required permission: ${permission}`);
	}
}
