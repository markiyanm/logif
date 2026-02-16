import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server.js";
import { withAuth, withAdmin } from "./lib/middleware.js";
import { notFound, forbidden } from "./lib/errors.js";
import { DEFAULT_CURRENCY } from "./lib/constants.js";

// ─── Validators ─────────────────────────────────────────────────────

const featuresValidator = v.object({
	maxCards: v.number(),
	maxApiRequests: v.number(),
	customBranding: v.boolean(),
	webhooks: v.boolean(),
	bulkOperations: v.boolean(),
	apiAccess: v.boolean(),
	emailTemplates: v.boolean(),
	multipleUsers: v.boolean(),
	maxUsers: v.number(),
});

const tierValidator = v.object({
	_id: v.id("subscriptionTiers"),
	_creationTime: v.number(),
	name: v.string(),
	slug: v.string(),
	targetEntity: v.union(v.literal("merchant"), v.literal("partner")),
	isActive: v.boolean(),
	monthlyPrice: v.number(),
	annualPrice: v.optional(v.number()),
	transactionFeePercent: v.number(),
	transactionFeeFlat: v.number(),
	features: featuresValidator,
	description: v.optional(v.string()),
	sortOrder: v.number(),
});

const invoiceLineItemValidator = v.object({
	_id: v.id("invoiceLineItems"),
	_creationTime: v.number(),
	invoiceId: v.id("invoices"),
	description: v.string(),
	type: v.union(
		v.literal("subscription"),
		v.literal("transaction_fee"),
		v.literal("overage"),
		v.literal("other"),
	),
	quantity: v.number(),
	unitPrice: v.number(),
	amount: v.number(),
});

const invoiceValidator = v.object({
	_id: v.id("invoices"),
	_creationTime: v.number(),
	merchantId: v.optional(v.id("merchants")),
	partnerId: v.optional(v.id("partners")),
	status: v.union(
		v.literal("draft"),
		v.literal("pending"),
		v.literal("paid"),
		v.literal("overdue"),
		v.literal("cancelled"),
	),
	periodStart: v.number(),
	periodEnd: v.number(),
	subtotal: v.number(),
	tax: v.number(),
	total: v.number(),
	currency: v.string(),
	dueDate: v.number(),
	paidAt: v.optional(v.number()),
	stripeInvoiceId: v.optional(v.string()),
});

// ─── List Tiers (Query) ─────────────────────────────────────────────

/**
 * List active subscription tiers. No auth needed.
 */
export const listTiers = query({
	args: {
		targetEntity: v.optional(
			v.union(v.literal("merchant"), v.literal("partner")),
		),
	},
	returns: v.array(tierValidator),
	handler: async (ctx, args) => {
		if (args.targetEntity) {
			return await ctx.db
				.query("subscriptionTiers")
				.withIndex("by_targetEntity_and_isActive", (q) =>
					q
						.eq("targetEntity", args.targetEntity!)
						.eq("isActive", true),
				)
				.collect();
		}

		// Return all active tiers across both entity types
		const merchantTiers = await ctx.db
			.query("subscriptionTiers")
			.withIndex("by_targetEntity_and_isActive", (q) =>
				q.eq("targetEntity", "merchant").eq("isActive", true),
			)
			.collect();

		const partnerTiers = await ctx.db
			.query("subscriptionTiers")
			.withIndex("by_targetEntity_and_isActive", (q) =>
				q.eq("targetEntity", "partner").eq("isActive", true),
			)
			.collect();

		const allTiers = [...merchantTiers, ...partnerTiers];
		allTiers.sort((a, b) => a.sortOrder - b.sortOrder);

		return allTiers;
	},
});

// ─── Get Tier by ID (Query) ─────────────────────────────────────────

/**
 * Get a subscription tier by ID.
 */
export const getTierById = query({
	args: {
		tierId: v.id("subscriptionTiers"),
	},
	returns: v.union(tierValidator, v.null()),
	handler: async (ctx, args) => {
		const tier = await ctx.db.get(args.tierId);
		return tier;
	},
});

// ─── Create Tier (Mutation) ─────────────────────────────────────────

/**
 * Admin-only: create a subscription tier.
 */
export const createTier = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		targetEntity: v.union(v.literal("merchant"), v.literal("partner")),
		monthlyPrice: v.number(),
		annualPrice: v.optional(v.number()),
		transactionFeePercent: v.number(),
		transactionFeeFlat: v.number(),
		features: featuresValidator,
		description: v.optional(v.string()),
		sortOrder: v.number(),
	},
	returns: v.id("subscriptionTiers"),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		const tierId = await ctx.db.insert("subscriptionTiers", {
			name: args.name,
			slug: args.slug,
			targetEntity: args.targetEntity,
			isActive: true,
			monthlyPrice: args.monthlyPrice,
			annualPrice: args.annualPrice,
			transactionFeePercent: args.transactionFeePercent,
			transactionFeeFlat: args.transactionFeeFlat,
			features: args.features,
			description: args.description,
			sortOrder: args.sortOrder,
		});

		return tierId;
	},
});

// ─── Update Tier (Mutation) ─────────────────────────────────────────

/**
 * Admin-only: update a subscription tier.
 */
export const updateTier = mutation({
	args: {
		tierId: v.id("subscriptionTiers"),
		name: v.optional(v.string()),
		monthlyPrice: v.optional(v.number()),
		annualPrice: v.optional(v.number()),
		transactionFeePercent: v.optional(v.number()),
		transactionFeeFlat: v.optional(v.number()),
		features: v.optional(featuresValidator),
		description: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		const tier = await ctx.db.get(args.tierId);
		if (!tier) {
			notFound("Subscription tier");
		}

		const patch: Record<string, unknown> = {};
		if (args.name !== undefined) patch.name = args.name;
		if (args.monthlyPrice !== undefined)
			patch.monthlyPrice = args.monthlyPrice;
		if (args.annualPrice !== undefined)
			patch.annualPrice = args.annualPrice;
		if (args.transactionFeePercent !== undefined)
			patch.transactionFeePercent = args.transactionFeePercent;
		if (args.transactionFeeFlat !== undefined)
			patch.transactionFeeFlat = args.transactionFeeFlat;
		if (args.features !== undefined) patch.features = args.features;
		if (args.description !== undefined)
			patch.description = args.description;
		if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
		if (args.isActive !== undefined) patch.isActive = args.isActive;

		if (Object.keys(patch).length > 0) {
			await ctx.db.patch(args.tierId, patch);
		}

		return null;
	},
});

// ─── Generate All Invoices (Internal Mutation) ──────────────────────

/**
 * Generate monthly invoices for all merchants and partners.
 * Called by daily cron. Creates invoice records with line items for
 * subscription fees + transaction fees.
 *
 * STUBBED: In production this would integrate with Stripe for actual billing.
 */
export const generateAllInvoices = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		// Calculate the previous month's period
		const periodEnd = now;
		const periodStart = now - 30 * 24 * 60 * 60 * 1000; // ~30 days ago
		const dueDate = now + 15 * 24 * 60 * 60 * 1000; // 15 days from now

		let invoicesCreated = 0;

		// Generate invoices for merchants with subscription tiers
		const merchantTiers = await ctx.db
			.query("subscriptionTiers")
			.withIndex("by_targetEntity_and_isActive", (q) =>
				q.eq("targetEntity", "merchant").eq("isActive", true),
			)
			.collect();

		for (const tier of merchantTiers) {
			// Find merchants on this tier
			// Since there's no direct index on subscriptionTierId, we look through active merchants
			const merchants = await ctx.db
				.query("merchants")
				.withIndex("by_status", (q) => q.eq("status", "active"))
				.collect();

			for (const merchant of merchants) {
				if (
					!merchant.subscriptionTierId ||
					merchant.subscriptionTierId !== tier._id
				) {
					continue;
				}

				// Calculate transaction fees for the period
				const transactions = await ctx.db
					.query("transactions")
					.withIndex("by_merchantId", (q) =>
						q.eq("merchantId", merchant._id),
					)
					.collect();

				// Filter to transactions within the period
				const periodTransactions = transactions.filter(
					(tx) =>
						tx._creationTime >= periodStart &&
						tx._creationTime <= periodEnd,
				);

				const transactionCount = periodTransactions.length;
				const totalTransactionVolume = periodTransactions.reduce(
					(sum, tx) => sum + Math.abs(tx.amount),
					0,
				);

				// Calculate fees
				const subscriptionFee = tier.monthlyPrice;
				const transactionFee =
					transactionCount > 0
						? Math.round(
								totalTransactionVolume *
									(tier.transactionFeePercent / 100) +
									transactionCount * tier.transactionFeeFlat,
							)
						: 0;

				const subtotal = subscriptionFee + transactionFee;
				const tax = 0; // Tax calculation is stubbed
				const total = subtotal + tax;

				if (total <= 0) continue;

				// Create invoice
				const invoiceId = await ctx.db.insert("invoices", {
					merchantId: merchant._id,
					status: "pending",
					periodStart,
					periodEnd,
					subtotal,
					tax,
					total,
					currency: DEFAULT_CURRENCY,
					dueDate,
				});

				// Add subscription line item
				await ctx.db.insert("invoiceLineItems", {
					invoiceId,
					description: `${tier.name} - Monthly Subscription`,
					type: "subscription",
					quantity: 1,
					unitPrice: subscriptionFee,
					amount: subscriptionFee,
				});

				// Add transaction fee line item (if any)
				if (transactionFee > 0) {
					await ctx.db.insert("invoiceLineItems", {
						invoiceId,
						description: `Transaction fees (${transactionCount} transactions, ${(totalTransactionVolume / 100).toFixed(2)} volume)`,
						type: "transaction_fee",
						quantity: transactionCount,
						unitPrice:
							transactionCount > 0
								? Math.round(
										transactionFee / transactionCount,
									)
								: 0,
						amount: transactionFee,
					});
				}

				invoicesCreated++;
			}
		}

		// Generate invoices for partners with subscription tiers
		const partnerTiers = await ctx.db
			.query("subscriptionTiers")
			.withIndex("by_targetEntity_and_isActive", (q) =>
				q.eq("targetEntity", "partner").eq("isActive", true),
			)
			.collect();

		for (const tier of partnerTiers) {
			const partners = await ctx.db
				.query("partners")
				.withIndex("by_status", (q) => q.eq("status", "active"))
				.collect();

			for (const partner of partners) {
				if (
					!partner.subscriptionTierId ||
					partner.subscriptionTierId !== tier._id
				) {
					continue;
				}

				const subscriptionFee = tier.monthlyPrice;
				const subtotal = subscriptionFee;
				const tax = 0;
				const total = subtotal + tax;

				if (total <= 0) continue;

				const invoiceId = await ctx.db.insert("invoices", {
					partnerId: partner._id,
					status: "pending",
					periodStart,
					periodEnd,
					subtotal,
					tax,
					total,
					currency: DEFAULT_CURRENCY,
					dueDate,
				});

				await ctx.db.insert("invoiceLineItems", {
					invoiceId,
					description: `${tier.name} - Monthly Subscription`,
					type: "subscription",
					quantity: 1,
					unitPrice: subscriptionFee,
					amount: subscriptionFee,
				});

				invoicesCreated++;
			}
		}

		return invoicesCreated;
	},
});

// ─── List Invoices (Query) ──────────────────────────────────────────

/**
 * List invoices for a merchant or partner.
 */
export const listInvoices = query({
	args: {
		merchantId: v.optional(v.id("merchants")),
		partnerId: v.optional(v.id("partners")),
	},
	returns: v.array(invoiceValidator),
	handler: async (ctx, args) => {
		await withAuth(ctx);

		if (args.merchantId) {
			await withAuth(ctx);
			return await ctx.db
				.query("invoices")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", args.merchantId),
				)
				.order("desc")
				.collect();
		}

		if (args.partnerId) {
			return await ctx.db
				.query("invoices")
				.withIndex("by_partnerId", (q) =>
					q.eq("partnerId", args.partnerId),
				)
				.order("desc")
				.collect();
		}

		return [];
	},
});

// ─── Get Invoice by ID (Query) ──────────────────────────────────────

/**
 * Get a single invoice with its line items.
 */
export const getInvoiceById = query({
	args: {
		invoiceId: v.id("invoices"),
	},
	returns: v.union(
		v.object({
			invoice: invoiceValidator,
			lineItems: v.array(invoiceLineItemValidator),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		await withAuth(ctx);

		const invoice = await ctx.db.get(args.invoiceId);
		if (!invoice) {
			return null;
		}

		// Verify access - user must have access to the merchant or partner
		// The withAuth check above ensures they're authenticated;
		// additional permission checks could be added here.

		const lineItems = await ctx.db
			.query("invoiceLineItems")
			.withIndex("by_invoiceId", (q) =>
				q.eq("invoiceId", args.invoiceId),
			)
			.collect();

		return {
			invoice,
			lineItems,
		};
	},
});
