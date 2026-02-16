import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server.js";
import { withAuth, withMerchant } from "./lib/middleware.js";
import { notFound, conflict, validationError } from "./lib/errors.js";
import {
	paginationArgs,
	getPaginationOpts,
	merchantScopeArgs,
} from "./lib/validators.js";

// ─── Shared return validators ──────────────────────────────────────

const customerReturnValidator = v.object({
	_id: v.id("customers"),
	_creationTime: v.number(),
	merchantId: v.id("merchants"),
	userId: v.optional(v.id("users")),
	email: v.string(),
	name: v.optional(v.string()),
	phone: v.optional(v.string()),
	loyaltyPoints: v.number(),
	totalSpent: v.number(),
	totalLoaded: v.number(),
	cardCount: v.number(),
});

// ─── Mutations ─────────────────────────────────────────────────────

/**
 * Create a new customer under a merchant.
 * Validates email uniqueness within the merchant using by_merchantId_and_email index.
 */
export const create = mutation({
	args: {
		merchantId: v.id("merchants"),
		email: v.string(),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
	},
	returns: v.id("customers"),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		// Validate email uniqueness within this merchant
		const existing = await ctx.db
			.query("customers")
			.withIndex("by_merchantId_and_email", (q) =>
				q.eq("merchantId", args.merchantId).eq("email", args.email),
			)
			.unique();

		if (existing) {
			conflict("A customer with this email already exists for this merchant");
		}

		const customerId = await ctx.db.insert("customers", {
			merchantId: args.merchantId,
			email: args.email,
			name: args.name,
			phone: args.phone,
			loyaltyPoints: 0,
			totalSpent: 0,
			totalLoaded: 0,
			cardCount: 0,
		});

		return customerId;
	},
});

/**
 * Update customer fields (name, phone, email).
 * Validates email uniqueness if changed.
 */
export const update = mutation({
	args: {
		customerId: v.id("customers"),
		merchantId: v.id("merchants"),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		email: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		if (customer.merchantId !== args.merchantId) {
			notFound("Customer");
		}

		// If email is changing, validate uniqueness within this merchant
		if (args.email !== undefined && args.email !== customer.email) {
			const existing = await ctx.db
				.query("customers")
				.withIndex("by_merchantId_and_email", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("email", args.email!),
				)
				.unique();

			if (existing) {
				conflict(
					"A customer with this email already exists for this merchant",
				);
			}
		}

		const updates: {
			name?: string;
			phone?: string;
			email?: string;
		} = {};

		if (args.name !== undefined) {
			updates.name = args.name;
		}
		if (args.phone !== undefined) {
			updates.phone = args.phone;
		}
		if (args.email !== undefined) {
			updates.email = args.email;
		}

		await ctx.db.patch(args.customerId, updates);
		return null;
	},
});

/**
 * Link a customer record to a portal user account.
 * Sets the userId on the customer.
 */
export const linkToUser = mutation({
	args: {
		customerId: v.id("customers"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		if (customer.userId && customer.userId !== user._id) {
			conflict("This customer record is already linked to another user");
		}

		await ctx.db.patch(args.customerId, { userId: user._id });
		return null;
	},
});

/**
 * Add or subtract loyalty points for a customer.
 * Points can be negative to subtract.
 */
export const adjustPoints = mutation({
	args: {
		merchantId: v.id("merchants"),
		customerId: v.id("customers"),
		points: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		if (customer.merchantId !== args.merchantId) {
			notFound("Customer");
		}

		const newPoints = customer.loyaltyPoints + args.points;
		if (newPoints < 0) {
			validationError("Insufficient loyalty points");
		}

		await ctx.db.patch(args.customerId, { loyaltyPoints: newPoints });
		return null;
	},
});

// ─── Queries ───────────────────────────────────────────────────────

/**
 * Get a customer by ID.
 * Merchant access is derived from the customer's merchantId.
 */
export const getById = query({
	args: {
		customerId: v.id("customers"),
	},
	returns: v.union(customerReturnValidator, v.null()),
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return null;
		}

		await withMerchant(ctx, customer.merchantId);

		return customer;
	},
});

/**
 * Get a customer by merchant and email using by_merchantId_and_email index.
 */
export const getByEmail = query({
	args: {
		merchantId: v.id("merchants"),
		email: v.string(),
	},
	returns: v.union(customerReturnValidator, v.null()),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		const customer = await ctx.db
			.query("customers")
			.withIndex("by_merchantId_and_email", (q) =>
				q.eq("merchantId", args.merchantId).eq("email", args.email),
			)
			.unique();

		return customer;
	},
});

/**
 * Paginated list of customers for a merchant.
 * Uses by_merchantId index.
 */
export const listByMerchant = query({
	args: {
		...merchantScopeArgs,
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(customerReturnValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		return await ctx.db
			.query("customers")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(getPaginationOpts(args));
	},
});

/**
 * Get the customer's own portal profile.
 * Uses withAuth and looks up the customer by userId using by_userId index.
 */
export const getPortalProfile = query({
	args: {},
	returns: v.union(customerReturnValidator, v.null()),
	handler: async (ctx) => {
		const { user } = await withAuth(ctx);

		const customer = await ctx.db
			.query("customers")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.unique();

		return customer;
	},
});

// ─── Internal Functions (API-facing, no user auth) ─────────────────

/**
 * Create a customer via API key (no user auth required).
 */
export const apiCreate = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		email: v.string(),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const merchant = await ctx.db.get(args.merchantId);
		if (!merchant) {
			notFound("Merchant");
		}

		const existing = await ctx.db
			.query("customers")
			.withIndex("by_merchantId_and_email", (q) =>
				q.eq("merchantId", args.merchantId).eq("email", args.email),
			)
			.unique();

		if (existing) {
			conflict("A customer with this email already exists for this merchant");
		}

		const customerId = await ctx.db.insert("customers", {
			merchantId: args.merchantId,
			email: args.email,
			name: args.name,
			phone: args.phone,
			loyaltyPoints: 0,
			totalSpent: 0,
			totalLoaded: 0,
			cardCount: 0,
		});

		return customerId;
	},
});

/**
 * Update a customer via API key (no user auth required).
 */
export const apiUpdate = internalMutation({
	args: {
		customerId: v.id("customers"),
		merchantId: v.id("merchants"),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		email: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		if (customer.merchantId !== args.merchantId) {
			notFound("Customer");
		}

		if (args.email !== undefined && args.email !== customer.email) {
			const existing = await ctx.db
				.query("customers")
				.withIndex("by_merchantId_and_email", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("email", args.email!),
				)
				.unique();

			if (existing) {
				conflict(
					"A customer with this email already exists for this merchant",
				);
			}
		}

		const updates: {
			name?: string;
			phone?: string;
			email?: string;
		} = {};

		if (args.name !== undefined) {
			updates.name = args.name;
		}
		if (args.phone !== undefined) {
			updates.phone = args.phone;
		}
		if (args.email !== undefined) {
			updates.email = args.email;
		}

		await ctx.db.patch(args.customerId, updates);
		return null;
	},
});

/**
 * Get a customer by ID via API key (no user auth required).
 */
export const apiGetById = internalQuery({
	args: {
		customerId: v.id("customers"),
		merchantId: v.optional(v.id("merchants")),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return null;
		}

		if (args.merchantId && customer.merchantId !== args.merchantId) {
			return null;
		}

		return customer;
	},
});

/**
 * List customers for a merchant via API key (no user auth required).
 */
export const apiListByMerchant = internalQuery({
	args: {
		merchantId: v.id("merchants"),
		cursor: v.optional(v.string()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const numItems = Math.min(args.limit ?? 25, 100);

		return await ctx.db
			.query("customers")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate({
				cursor: args.cursor ?? null,
				numItems,
			});
	},
});
