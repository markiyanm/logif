import { v } from "convex/values";
import { query, mutation } from "./_generated/server.js";
import {
	withAuth,
	withAdmin,
	withPartner,
} from "./lib/middleware.js";
import {
	conflict,
	forbidden,
	notFound,
	validationError,
} from "./lib/errors.js";
import {
	paginationArgs,
	getPaginationOpts,
} from "./lib/validators.js";

// ─── Validators ─────────────────────────────────────────────────────

const partnerValidator = v.object({
	_id: v.id("partners"),
	_creationTime: v.number(),
	name: v.string(),
	slug: v.string(),
	ownerUserId: v.id("users"),
	status: v.union(
		v.literal("active"),
		v.literal("suspended"),
		v.literal("pending"),
	),
	contactEmail: v.string(),
	website: v.optional(v.string()),
	description: v.optional(v.string()),
	logoStorageId: v.optional(v.id("_storage")),
	subscriptionTierId: v.optional(v.id("subscriptionTiers")),
});

// ─── Create Partner (Mutation) ──────────────────────────────────────

/**
 * Create a partner organization.
 * Validates slug uniqueness. Creates partnerMembers entry with owner role.
 */
export const create = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		contactEmail: v.string(),
		website: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	returns: v.id("partners"),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		// Validate slug format
		if (!/^[a-z0-9-]+$/.test(args.slug)) {
			validationError(
				"Slug must contain only lowercase letters, numbers, and hyphens",
			);
		}

		// Validate slug uniqueness
		const existingPartner = await ctx.db
			.query("partners")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		if (existingPartner) {
			conflict("A partner with this slug already exists");
		}

		// Create the partner
		const partnerId = await ctx.db.insert("partners", {
			name: args.name,
			slug: args.slug,
			ownerUserId: user._id,
			status: "active",
			contactEmail: args.contactEmail,
			website: args.website,
			description: args.description,
		});

		// Create partner membership with owner role
		await ctx.db.insert("partnerMembers", {
			partnerId,
			userId: user._id,
			role: "owner",
		});

		return partnerId;
	},
});

// ─── Get by ID (Query) ─────────────────────────────────────────────

/**
 * Get a partner by ID. Requires partner access.
 */
export const getById = query({
	args: {
		partnerId: v.id("partners"),
	},
	returns: v.union(partnerValidator, v.null()),
	handler: async (ctx, args) => {
		const { partner } = await withPartner(ctx, args.partnerId);
		return partner;
	},
});

// ─── Update Partner (Mutation) ──────────────────────────────────────

/**
 * Update partner details. Requires partner owner or admin role.
 */
export const update = mutation({
	args: {
		partnerId: v.id("partners"),
		name: v.optional(v.string()),
		contactEmail: v.optional(v.string()),
		website: v.optional(v.string()),
		description: v.optional(v.string()),
		logoStorageId: v.optional(v.id("_storage")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { memberRole } = await withPartner(ctx, args.partnerId);

		if (memberRole !== "owner" && memberRole !== "admin") {
			forbidden("Only partner owners and admins can update details");
		}

		const { partnerId, ...updates } = args;

		const patch: Record<string, unknown> = {};
		if (updates.name !== undefined) patch.name = updates.name;
		if (updates.contactEmail !== undefined)
			patch.contactEmail = updates.contactEmail;
		if (updates.website !== undefined) patch.website = updates.website;
		if (updates.description !== undefined)
			patch.description = updates.description;
		if (updates.logoStorageId !== undefined)
			patch.logoStorageId = updates.logoStorageId;

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(partnerId, patch);
		}

		return null;
	},
});

// ─── List Partners (Query) ──────────────────────────────────────────

/**
 * Admin-only paginated partner list.
 */
export const list = query({
	args: {
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(partnerValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withAdmin(ctx);
		const paginationOpts = getPaginationOpts(args);

		return await ctx.db
			.query("partners")
			.order("desc")
			.paginate(paginationOpts);
	},
});

// ─── Get Partner Stats (Query) ──────────────────────────────────────

/**
 * Partner stats: merchant count, total API keys, total transactions across merchants.
 */
export const getStats = query({
	args: {
		partnerId: v.id("partners"),
	},
	returns: v.object({
		merchantCount: v.number(),
		activeMerchantCount: v.number(),
		totalApiKeys: v.number(),
		totalTransactions: v.number(),
		totalTransactionVolume: v.number(),
		totalCards: v.number(),
	}),
	handler: async (ctx, args) => {
		await withPartner(ctx, args.partnerId);

		// Get merchants under this partner
		const merchants = await ctx.db
			.query("merchants")
			.withIndex("by_partnerId", (q) =>
				q.eq("partnerId", args.partnerId),
			)
			.collect();

		const merchantCount = merchants.length;
		const activeMerchantCount = merchants.filter(
			(m) => m.status === "active",
		).length;

		// Get partner API keys
		const apiKeys = await ctx.db
			.query("apiKeys")
			.withIndex("by_partnerId", (q) =>
				q.eq("partnerId", args.partnerId),
			)
			.collect();

		// Aggregate stats across all partner merchants
		let totalTransactions = 0;
		let totalTransactionVolume = 0;
		let totalCards = 0;

		for (const merchant of merchants) {
			const transactions = await ctx.db
				.query("transactions")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", merchant._id),
				)
				.collect();

			totalTransactions += transactions.length;
			totalTransactionVolume += transactions.reduce(
				(sum, tx) => sum + Math.abs(tx.amount),
				0,
			);

			const cards = await ctx.db
				.query("cards")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", merchant._id),
				)
				.collect();

			totalCards += cards.length;
		}

		return {
			merchantCount,
			activeMerchantCount,
			totalApiKeys: apiKeys.length,
			totalTransactions,
			totalTransactionVolume,
			totalCards,
		};
	},
});
