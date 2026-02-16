import { v } from "convex/values";
import { query, mutation } from "./_generated/server.js";
import { withAuth, withMerchant, withPartner } from "./lib/middleware.js";
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

// ─── Address & Theme Validators ────────────────────────────────────

const addressValidator = v.object({
	street: v.string(),
	city: v.string(),
	state: v.string(),
	zip: v.string(),
	country: v.string(),
});

const themeValidator = v.object({
	primary: v.optional(v.string()),
	primaryForeground: v.optional(v.string()),
	secondary: v.optional(v.string()),
	secondaryForeground: v.optional(v.string()),
	accent: v.optional(v.string()),
	accentForeground: v.optional(v.string()),
	background: v.optional(v.string()),
	foreground: v.optional(v.string()),
	card: v.optional(v.string()),
	cardForeground: v.optional(v.string()),
	muted: v.optional(v.string()),
	mutedForeground: v.optional(v.string()),
	destructive: v.optional(v.string()),
	border: v.optional(v.string()),
	input: v.optional(v.string()),
	ring: v.optional(v.string()),
	radius: v.optional(v.string()),
});

const settingsValidator = v.object({
	defaultCardExpDays: v.optional(v.number()),
	maxCardBalance: v.optional(v.number()),
	minLoadAmount: v.optional(v.number()),
	maxLoadAmount: v.optional(v.number()),
	allowPartialRedeem: v.optional(v.boolean()),
	requirePin: v.optional(v.boolean()),
	currency: v.optional(v.string()),
});

// ─── Get My Merchant (for current user) ───────────────────────────

export const getMyMerchant = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id("merchants"),
			_creationTime: v.number(),
			name: v.string(),
			slug: v.string(),
			ownerUserId: v.id("users"),
			partnerId: v.optional(v.id("partners")),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			contactEmail: v.string(),
			phone: v.optional(v.string()),
			address: v.optional(addressValidator),
			website: v.optional(v.string()),
			description: v.optional(v.string()),
			logoStorageId: v.optional(v.id("_storage")),
			theme: v.optional(themeValidator),
			settings: v.optional(settingsValidator),
			subscriptionTierId: v.optional(v.id("subscriptionTiers")),
			transactionFeePercent: v.optional(v.number()),
			transactionFeeFlat: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (!user) {
			return null;
		}

		const membership = await ctx.db
			.query("merchantMembers")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.first();

		if (!membership) {
			return null;
		}

		return await ctx.db.get(membership.merchantId);
	},
});

// ─── 1. Create Merchant ────────────────────────────────────────────

export const create = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		contactEmail: v.string(),
		partnerId: v.optional(v.id("partners")),
		description: v.optional(v.string()),
		website: v.optional(v.string()),
		phone: v.optional(v.string()),
		address: v.optional(addressValidator),
	},
	returns: v.id("merchants"),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		// Validate slug format
		if (!/^[a-z0-9-]+$/.test(args.slug)) {
			validationError(
				"Slug must contain only lowercase letters, numbers, and hyphens",
			);
		}

		// Validate slug uniqueness
		const existingMerchant = await ctx.db
			.query("merchants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		if (existingMerchant) {
			conflict("A merchant with this slug already exists");
		}

		// Create the merchant
		const merchantId = await ctx.db.insert("merchants", {
			name: args.name,
			slug: args.slug,
			ownerUserId: user._id,
			partnerId: args.partnerId,
			status: "active",
			contactEmail: args.contactEmail,
			phone: args.phone,
			address: args.address,
			website: args.website,
			description: args.description,
		});

		// Create merchant membership with owner role
		await ctx.db.insert("merchantMembers", {
			merchantId,
			userId: user._id,
			role: "owner",
		});

		return merchantId;
	},
});

// ─── 2. Get Merchant by ID ────────────────────────────────────────

export const getById = query({
	args: {
		merchantId: v.id("merchants"),
	},
	returns: v.union(
		v.object({
			_id: v.id("merchants"),
			_creationTime: v.number(),
			name: v.string(),
			slug: v.string(),
			ownerUserId: v.id("users"),
			partnerId: v.optional(v.id("partners")),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			contactEmail: v.string(),
			phone: v.optional(v.string()),
			address: v.optional(addressValidator),
			website: v.optional(v.string()),
			description: v.optional(v.string()),
			logoStorageId: v.optional(v.id("_storage")),
			theme: v.optional(themeValidator),
			settings: v.optional(settingsValidator),
			subscriptionTierId: v.optional(v.id("subscriptionTiers")),
			transactionFeePercent: v.optional(v.number()),
			transactionFeeFlat: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const { merchant } = await withMerchant(ctx, args.merchantId);
		return merchant;
	},
});

// ─── 3. Get Merchant by Slug (Public) ─────────────────────────────

export const getBySlug = query({
	args: {
		slug: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("merchants"),
			_creationTime: v.number(),
			name: v.string(),
			slug: v.string(),
			ownerUserId: v.id("users"),
			partnerId: v.optional(v.id("partners")),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			contactEmail: v.string(),
			phone: v.optional(v.string()),
			address: v.optional(addressValidator),
			website: v.optional(v.string()),
			description: v.optional(v.string()),
			logoStorageId: v.optional(v.id("_storage")),
			theme: v.optional(themeValidator),
			settings: v.optional(settingsValidator),
			subscriptionTierId: v.optional(v.id("subscriptionTiers")),
			transactionFeePercent: v.optional(v.number()),
			transactionFeeFlat: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const merchant = await ctx.db
			.query("merchants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		return merchant;
	},
});

// ─── 4. Update Merchant ───────────────────────────────────────────

export const update = mutation({
	args: {
		merchantId: v.id("merchants"),
		name: v.optional(v.string()),
		contactEmail: v.optional(v.string()),
		phone: v.optional(v.string()),
		address: v.optional(addressValidator),
		website: v.optional(v.string()),
		description: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { memberRole } = await withMerchant(ctx, args.merchantId);

		if (memberRole !== "owner" && memberRole !== "admin") {
			forbidden("Only owners and admins can update merchant details");
		}

		const { merchantId, ...updates } = args;

		// Build a patch with only defined fields
		const patch: Record<string, unknown> = {};
		if (updates.name !== undefined) patch.name = updates.name;
		if (updates.contactEmail !== undefined)
			patch.contactEmail = updates.contactEmail;
		if (updates.phone !== undefined) patch.phone = updates.phone;
		if (updates.address !== undefined) patch.address = updates.address;
		if (updates.website !== undefined) patch.website = updates.website;
		if (updates.description !== undefined)
			patch.description = updates.description;

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(merchantId, patch);
		}

		return null;
	},
});

// ─── 5. List Merchants (Paginated) ────────────────────────────────

export const list = query({
	args: {
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(
			v.object({
				_id: v.id("merchants"),
				_creationTime: v.number(),
				name: v.string(),
				slug: v.string(),
				ownerUserId: v.id("users"),
				partnerId: v.optional(v.id("partners")),
				status: v.union(
					v.literal("active"),
					v.literal("suspended"),
					v.literal("pending"),
				),
				contactEmail: v.string(),
				phone: v.optional(v.string()),
				address: v.optional(addressValidator),
				website: v.optional(v.string()),
				description: v.optional(v.string()),
				logoStorageId: v.optional(v.id("_storage")),
				theme: v.optional(themeValidator),
				settings: v.optional(settingsValidator),
				subscriptionTierId: v.optional(v.id("subscriptionTiers")),
				transactionFeePercent: v.optional(v.number()),
				transactionFeeFlat: v.optional(v.number()),
			}),
		),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);
		const paginationOpts = getPaginationOpts(args);

		// Admin: all merchants
		if (user.role === "admin") {
			return await ctx.db
				.query("merchants")
				.order("desc")
				.paginate(paginationOpts);
		}

		// Partner: merchants under their partner organizations
		if (user.role === "partner") {
			// Find which partner org this user belongs to
			const partnerMembership = await ctx.db
				.query("partnerMembers")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.first();

			if (partnerMembership) {
				return await ctx.db
					.query("merchants")
					.withIndex("by_partnerId", (q) =>
						q.eq("partnerId", partnerMembership.partnerId),
					)
					.order("desc")
					.paginate(paginationOpts);
			}
		}

		// Merchant users: only merchants they are members of
		const memberships = await ctx.db
			.query("merchantMembers")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.collect();

		const merchants = [];
		for (const membership of memberships) {
			const merchant = await ctx.db.get(membership.merchantId);
			if (merchant) {
				merchants.push(merchant);
			}
		}

		// Sort descending by creation time to match paginated behavior
		merchants.sort((a, b) => b._creationTime - a._creationTime);

		return {
			page: merchants,
			isDone: true,
			continueCursor: "",
		};
	},
});

// ─── 6. Get Merchant Stats ────────────────────────────────────────

export const getStats = query({
	args: {
		merchantId: v.id("merchants"),
	},
	returns: v.object({
		cardCount: v.number(),
		activeCards: v.number(),
		totalLoaded: v.number(),
		totalRedeemed: v.number(),
		customerCount: v.number(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		// Count all cards for this merchant
		const allCards = await ctx.db
			.query("cards")
			.withIndex("by_merchantId", (q) => q.eq("merchantId", args.merchantId))
			.collect();

		const cardCount = allCards.length;

		// Count active cards using index
		const activeCards = await ctx.db
			.query("cards")
			.withIndex("by_merchantId_and_status", (q) =>
				q.eq("merchantId", args.merchantId).eq("status", "active"),
			)
			.collect();

		const activeCardCount = activeCards.length;

		// Compute total loaded from load transactions
		const loadTransactions = await ctx.db
			.query("transactions")
			.withIndex("by_merchantId_and_type", (q) =>
				q.eq("merchantId", args.merchantId).eq("type", "load"),
			)
			.collect();

		const totalLoaded = loadTransactions.reduce(
			(sum, tx) => sum + tx.amount,
			0,
		);

		// Compute total redeemed from redeem transactions
		const redeemTransactions = await ctx.db
			.query("transactions")
			.withIndex("by_merchantId_and_type", (q) =>
				q.eq("merchantId", args.merchantId).eq("type", "redeem"),
			)
			.collect();

		const totalRedeemed = redeemTransactions.reduce(
			(sum, tx) => sum + Math.abs(tx.amount),
			0,
		);

		// Count customers
		const customers = await ctx.db
			.query("customers")
			.withIndex("by_merchantId", (q) => q.eq("merchantId", args.merchantId))
			.collect();

		const customerCount = customers.length;

		return {
			cardCount,
			activeCards: activeCardCount,
			totalLoaded,
			totalRedeemed,
			customerCount,
		};
	},
});

// ─── 7. Update Branding ───────────────────────────────────────────

export const updateBranding = mutation({
	args: {
		merchantId: v.id("merchants"),
		theme: v.optional(themeValidator),
		logoStorageId: v.optional(v.id("_storage")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { memberRole } = await withMerchant(ctx, args.merchantId);

		if (memberRole !== "owner" && memberRole !== "admin") {
			forbidden("Only owners and admins can update branding");
		}

		const patch: Record<string, unknown> = {};
		if (args.theme !== undefined) patch.theme = args.theme;
		if (args.logoStorageId !== undefined)
			patch.logoStorageId = args.logoStorageId;

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(args.merchantId, patch);
		}

		return null;
	},
});

// ─── 8. Update Settings ───────────────────────────────────────────

export const updateSettings = mutation({
	args: {
		merchantId: v.id("merchants"),
		settings: settingsValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { merchant, memberRole } = await withMerchant(
			ctx,
			args.merchantId,
		);

		if (memberRole !== "owner" && memberRole !== "admin") {
			forbidden("Only owners and admins can update settings");
		}

		// Merge with existing settings so partial updates are supported
		const currentSettings = merchant.settings ?? {};
		const mergedSettings = { ...currentSettings, ...args.settings };

		await ctx.db.patch(args.merchantId, { settings: mergedSettings });

		return null;
	},
});

// ─── 9. Get Public Profile (Unauthenticated) ─────────────────────

export const getPublicProfile = query({
	args: {
		slug: v.string(),
	},
	returns: v.union(
		v.object({
			name: v.string(),
			slug: v.string(),
			description: v.optional(v.string()),
			logoStorageId: v.optional(v.id("_storage")),
			theme: v.optional(themeValidator),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const merchant = await ctx.db
			.query("merchants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		if (!merchant || merchant.status !== "active") {
			return null;
		}

		return {
			name: merchant.name,
			slug: merchant.slug,
			description: merchant.description,
			logoStorageId: merchant.logoStorageId,
			theme: merchant.theme,
		};
	},
});

// ─── 10. List Merchants by Partner ────────────────────────────────

export const listByPartner = query({
	args: {
		partnerId: v.id("partners"),
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(
			v.object({
				_id: v.id("merchants"),
				_creationTime: v.number(),
				name: v.string(),
				slug: v.string(),
				ownerUserId: v.id("users"),
				partnerId: v.optional(v.id("partners")),
				status: v.union(
					v.literal("active"),
					v.literal("suspended"),
					v.literal("pending"),
				),
				contactEmail: v.string(),
				phone: v.optional(v.string()),
				address: v.optional(addressValidator),
				website: v.optional(v.string()),
				description: v.optional(v.string()),
				logoStorageId: v.optional(v.id("_storage")),
				theme: v.optional(themeValidator),
				settings: v.optional(settingsValidator),
				subscriptionTierId: v.optional(v.id("subscriptionTiers")),
				transactionFeePercent: v.optional(v.number()),
				transactionFeeFlat: v.optional(v.number()),
			}),
		),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withPartner(ctx, args.partnerId);
		const paginationOpts = getPaginationOpts(args);

		return await ctx.db
			.query("merchants")
			.withIndex("by_partnerId", (q) => q.eq("partnerId", args.partnerId))
			.order("desc")
			.paginate(paginationOpts);
	},
});
