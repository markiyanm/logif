import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
	query,
	mutation,
	internalMutation,
	internalQuery,
} from "./_generated/server.js";
import { withMerchant } from "./lib/middleware.js";
import {
	notFound,
	validationError,
	cardInactive,
	cardExpired,
	forbidden,
} from "./lib/errors.js";
import { generateCardNumber } from "./lib/cardNumber.js";
import { generateRedemptionCode } from "./lib/codeGenerator.js";
import { sha256 } from "./lib/crypto.js";
import {
	paginationArgs,
	getPaginationOpts,
	merchantScopeArgs,
} from "./lib/validators.js";
import {
	DEFAULT_CARD_EXP_DAYS,
	DEFAULT_CURRENCY,
} from "./lib/constants.js";

// ─── Card validator (reusable for return types) ────────────────────
const cardValidator = v.object({
	_id: v.id("cards"),
	_creationTime: v.number(),
	merchantId: v.id("merchants"),
	customerId: v.optional(v.id("customers")),
	cardNumber: v.string(),
	code: v.string(),
	codeHash: v.string(),
	pin: v.optional(v.string()),
	trackData: v.optional(v.string()),
	trackDataHash: v.optional(v.string()),
	type: v.union(v.literal("physical"), v.literal("digital")),
	status: v.union(
		v.literal("active"),
		v.literal("inactive"),
		v.literal("suspended"),
		v.literal("expired"),
		v.literal("cancelled"),
	),
	initialBalance: v.number(),
	currentBalance: v.number(),
	currency: v.string(),
	expiresAt: v.optional(v.number()),
	activatedAt: v.optional(v.number()),
	lastUsedAt: v.optional(v.number()),
	metadata: v.optional(v.any()),
	importBatchId: v.optional(v.id("importBatches")),
});

// ─── Mutations ─────────────────────────────────────────────────────

/**
 * Create a single gift card for a merchant.
 */
export const createSingle = mutation({
	args: {
		...merchantScopeArgs,
		type: v.union(v.literal("physical"), v.literal("digital")),
		initialBalance: v.number(),
		currency: v.optional(v.string()),
		customerId: v.optional(v.id("customers")),
		expiresAt: v.optional(v.number()),
		pin: v.optional(v.string()),
		trackData: v.optional(v.string()),
	},
	returns: cardValidator,
	handler: async (ctx, args) => {
		const { merchant } = await withMerchant(ctx, args.merchantId);

		if (args.initialBalance < 0) {
			validationError("Initial balance must be non-negative");
		}

		const maxBalance =
			merchant.settings?.maxCardBalance ?? undefined;
		if (maxBalance !== undefined && args.initialBalance > maxBalance) {
			validationError(
				`Initial balance exceeds maximum allowed (${maxBalance} cents)`,
			);
		}

		const cardNumber = generateCardNumber();
		const redemptionCode = generateRedemptionCode();
		const codeHash = await sha256(redemptionCode);

		let trackDataHash: string | undefined;
		if (args.trackData) {
			trackDataHash = await sha256(args.trackData);
		}

		const currency = args.currency ?? merchant.settings?.currency ?? DEFAULT_CURRENCY;

		const expDays = merchant.settings?.defaultCardExpDays ?? DEFAULT_CARD_EXP_DAYS;
		const expiresAt =
			args.expiresAt ?? Date.now() + expDays * 24 * 60 * 60 * 1000;

		const cardId = await ctx.db.insert("cards", {
			merchantId: args.merchantId,
			customerId: args.customerId,
			cardNumber,
			code: redemptionCode,
			codeHash,
			pin: args.pin,
			trackData: trackDataHash, // store hash, not raw
			trackDataHash,
			type: args.type,
			status: "active",
			initialBalance: args.initialBalance,
			currentBalance: args.initialBalance,
			currency,
			expiresAt,
			activatedAt: Date.now(),
		});

		const card = await ctx.db.get(cardId);
		return card!;
	},
});

/**
 * Update card status (activate, suspend, cancel).
 */
export const updateStatus = mutation({
	args: {
		...merchantScopeArgs,
		cardId: v.id("cards"),
		status: v.union(
			v.literal("active"),
			v.literal("suspended"),
			v.literal("cancelled"),
		),
	},
	returns: cardValidator,
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}

		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		// Cannot reactivate a cancelled card
		if (card.status === "cancelled" && args.status === "active") {
			validationError("Cannot reactivate a cancelled card");
		}

		// Cannot reactivate an expired card
		if (card.status === "expired" && args.status === "active") {
			validationError("Cannot reactivate an expired card");
		}

		const updates: Record<string, unknown> = { status: args.status };
		if (args.status === "active" && !card.activatedAt) {
			updates.activatedAt = Date.now();
		}

		await ctx.db.patch(args.cardId, updates);

		const updated = await ctx.db.get(args.cardId);
		return updated!;
	},
});

// ─── Queries ───────────────────────────────────────────────────────

/**
 * Get a card by its ID. Requires merchant access.
 */
export const getById = query({
	args: {
		cardId: v.id("cards"),
	},
	returns: v.union(cardValidator, v.null()),
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) {
			return null;
		}

		await withMerchant(ctx, card.merchantId);

		return card;
	},
});

/**
 * Get a card by card number.
 */
export const getByCardNumber = query({
	args: {
		cardNumber: v.string(),
	},
	returns: v.union(cardValidator, v.null()),
	handler: async (ctx, args) => {
		const card = await ctx.db
			.query("cards")
			.withIndex("by_cardNumber", (q) =>
				q.eq("cardNumber", args.cardNumber),
			)
			.unique();

		if (!card) {
			return null;
		}

		await withMerchant(ctx, card.merchantId);

		return card;
	},
});

/**
 * Paginated card list for a merchant. Optional status filter.
 */
export const listByMerchant = query({
	args: {
		...merchantScopeArgs,
		status: v.optional(
			v.union(
				v.literal("active"),
				v.literal("inactive"),
				v.literal("suspended"),
				v.literal("expired"),
				v.literal("cancelled"),
			),
		),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		page: v.array(cardValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		if (args.status) {
			return await ctx.db
				.query("cards")
				.withIndex("by_merchantId_and_status", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("status", args.status!),
				)
				.order("desc")
				.paginate(args.paginationOpts);
		}

		return await ctx.db
			.query("cards")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

/**
 * List cards for a customer.
 */
export const listByCustomer = query({
	args: {
		customerId: v.id("customers"),
	},
	returns: v.array(cardValidator),
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		await withMerchant(ctx, customer.merchantId);

		return await ctx.db
			.query("cards")
			.withIndex("by_customerId", (q) =>
				q.eq("customerId", args.customerId),
			)
			.collect();
	},
});

/**
 * Public balance check by card number. No auth required.
 * Returns only balance and status -- no sensitive data.
 */
export const checkBalance = query({
	args: {
		cardNumber: v.string(),
	},
	returns: v.union(
		v.object({
			currentBalance: v.number(),
			currency: v.string(),
			status: v.union(
				v.literal("active"),
				v.literal("inactive"),
				v.literal("suspended"),
				v.literal("expired"),
				v.literal("cancelled"),
			),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const card = await ctx.db
			.query("cards")
			.withIndex("by_cardNumber", (q) =>
				q.eq("cardNumber", args.cardNumber),
			)
			.unique();

		if (!card) {
			return null;
		}

		return {
			currentBalance: card.currentBalance,
			currency: card.currency,
			status: card.status,
		};
	},
});

/**
 * Full-text search on card number within a merchant.
 */
export const search = query({
	args: {
		...merchantScopeArgs,
		query: v.string(),
	},
	returns: v.array(cardValidator),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		return await ctx.db
			.query("cards")
			.withSearchIndex("search_cardNumber", (q) =>
				q
					.search("cardNumber", args.query)
					.eq("merchantId", args.merchantId),
			)
			.collect();
	},
});

// ─── Internal Functions (API-facing, no user auth) ─────────────────

/**
 * Create a card via API key (no user auth required).
 * Called from httpAction where auth is handled by API key validation.
 */
export const apiCreateSingle = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		type: v.union(v.literal("physical"), v.literal("digital")),
		initialBalance: v.number(),
		currency: v.optional(v.string()),
		customerId: v.optional(v.id("customers")),
		expiresAt: v.optional(v.number()),
		pin: v.optional(v.string()),
		trackData: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const merchant = await ctx.db.get(args.merchantId);
		if (!merchant) {
			notFound("Merchant");
		}

		if (args.initialBalance < 0) {
			validationError("Initial balance must be non-negative");
		}

		const maxBalance = merchant.settings?.maxCardBalance ?? undefined;
		if (maxBalance !== undefined && args.initialBalance > maxBalance) {
			validationError(
				`Initial balance exceeds maximum allowed (${maxBalance} cents)`,
			);
		}

		const cardNumber = generateCardNumber();
		const redemptionCode = generateRedemptionCode();
		const codeHash = await sha256(redemptionCode);

		let trackDataHash: string | undefined;
		if (args.trackData) {
			trackDataHash = await sha256(args.trackData);
		}

		const currency =
			args.currency ?? merchant.settings?.currency ?? DEFAULT_CURRENCY;

		const expDays =
			merchant.settings?.defaultCardExpDays ?? DEFAULT_CARD_EXP_DAYS;
		const expiresAt =
			args.expiresAt ?? Date.now() + expDays * 24 * 60 * 60 * 1000;

		const cardId = await ctx.db.insert("cards", {
			merchantId: args.merchantId,
			customerId: args.customerId,
			cardNumber,
			code: redemptionCode,
			codeHash,
			pin: args.pin,
			trackData: trackDataHash,
			trackDataHash,
			type: args.type,
			status: "active",
			initialBalance: args.initialBalance,
			currentBalance: args.initialBalance,
			currency,
			expiresAt,
			activatedAt: Date.now(),
		});

		const card = await ctx.db.get(cardId);
		return card!;
	},
});

/**
 * Update card status via API key (no user auth required).
 */
export const apiUpdateStatus = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		cardId: v.id("cards"),
		status: v.union(
			v.literal("active"),
			v.literal("suspended"),
			v.literal("cancelled"),
		),
	},
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}

		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		if (card.status === "cancelled" && args.status === "active") {
			validationError("Cannot reactivate a cancelled card");
		}

		if (card.status === "expired" && args.status === "active") {
			validationError("Cannot reactivate an expired card");
		}

		const updates: Record<string, unknown> = { status: args.status };
		if (args.status === "active" && !card.activatedAt) {
			updates.activatedAt = Date.now();
		}

		await ctx.db.patch(args.cardId, updates);

		const updated = await ctx.db.get(args.cardId);
		return updated!;
	},
});

/**
 * Get a card by ID via API key (no user auth required).
 */
export const apiGetById = internalQuery({
	args: {
		cardId: v.id("cards"),
		merchantId: v.optional(v.id("merchants")),
	},
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) {
			return null;
		}

		// If merchantId provided, verify ownership
		if (args.merchantId && card.merchantId !== args.merchantId) {
			return null;
		}

		return card;
	},
});

/**
 * List cards for a merchant via API key (no user auth required).
 */
export const apiListByMerchant = internalQuery({
	args: {
		merchantId: v.id("merchants"),
		status: v.optional(
			v.union(
				v.literal("active"),
				v.literal("inactive"),
				v.literal("suspended"),
				v.literal("expired"),
				v.literal("cancelled"),
			),
		),
		paginationOpts: v.object({
			cursor: v.union(v.string(), v.null()),
			numItems: v.number(),
		}),
	},
	handler: async (ctx, args) => {
		if (args.status) {
			return await ctx.db
				.query("cards")
				.withIndex("by_merchantId_and_status", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("status", args.status!),
				)
				.order("desc")
				.paginate(args.paginationOpts);
		}

		return await ctx.db
			.query("cards")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

/**
 * Public balance check (no auth). Same as checkBalance but internal.
 */
export const apiCheckBalance = internalQuery({
	args: {
		cardNumber: v.string(),
	},
	handler: async (ctx, args) => {
		const card = await ctx.db
			.query("cards")
			.withIndex("by_cardNumber", (q) =>
				q.eq("cardNumber", args.cardNumber),
			)
			.unique();

		if (!card) {
			return null;
		}

		return {
			currentBalance: card.currentBalance,
			currency: card.currency,
			status: card.status,
		};
	},
});

/**
 * Batch-expire cards that are past their expiresAt timestamp.
 * Designed to be called from a cron job.
 */
export const expireCards = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();
		let expiredCount = 0;

		// Query active cards and check expiration
		// We use the by_merchantId_and_status index to find active cards
		const activeCards = await ctx.db
			.query("cards")
			.withIndex("by_merchantId_and_status")
			.collect();

		for (const card of activeCards) {
			if (
				card.status === "active" &&
				card.expiresAt &&
				card.expiresAt <= now
			) {
				await ctx.db.patch(card._id, { status: "expired" });
				expiredCount++;
			}
		}

		return expiredCount;
	},
});
