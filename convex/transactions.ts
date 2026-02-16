import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server.js";
import { Doc, Id } from "./_generated/dataModel.js";
import { withMerchant, type MerchantContext } from "./lib/middleware.js";
import {
	notFound,
	validationError,
	insufficientBalance,
	cardInactive,
	cardExpired,
	invalidAmount,
	forbidden,
} from "./lib/errors.js";
import { sha256 } from "./lib/crypto.js";
import { merchantScopeArgs } from "./lib/validators.js";
import {
	DEFAULT_MAX_CARD_BALANCE,
	DEFAULT_MIN_LOAD_AMOUNT,
	DEFAULT_MAX_LOAD_AMOUNT,
} from "./lib/constants.js";
import type { MutationCtx } from "./_generated/server.js";

// ─── Transaction validator (reusable for return types) ─────────────
const transactionValidator = v.object({
	_id: v.id("transactions"),
	_creationTime: v.number(),
	merchantId: v.id("merchants"),
	cardId: v.id("cards"),
	customerId: v.optional(v.id("customers")),
	type: v.union(
		v.literal("load"),
		v.literal("redeem"),
		v.literal("transfer_in"),
		v.literal("transfer_out"),
		v.literal("adjust"),
		v.literal("refund"),
	),
	amount: v.number(),
	balanceBefore: v.number(),
	balanceAfter: v.number(),
	currency: v.string(),
	description: v.optional(v.string()),
	reference: v.optional(v.string()),
	performedBy: v.optional(v.string()),
	performedByType: v.optional(
		v.union(
			v.literal("user"),
			v.literal("api_key"),
			v.literal("system"),
		),
	),
	redemptionMethod: v.optional(
		v.union(
			v.literal("code"),
			v.literal("card_number"),
			v.literal("track_data"),
			v.literal("qr"),
			v.literal("manual"),
		),
	),
	linkedTransactionId: v.optional(v.id("transactions")),
	feeAmount: v.optional(v.number()),
	metadata: v.optional(v.any()),
});

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Validate that a card is usable for financial operations.
 * Checks active status and expiration.
 */
function validateCardUsable(card: Doc<"cards">): void {
	if (card.status !== "active") {
		cardInactive();
	}
	if (card.expiresAt && card.expiresAt <= Date.now()) {
		cardExpired();
	}
}

/**
 * Create a transaction record and update the card's balance and lastUsedAt.
 */
async function recordTransaction(
	ctx: MutationCtx,
	params: {
		card: Doc<"cards">;
		type: "load" | "redeem" | "transfer_in" | "transfer_out" | "adjust" | "refund";
		amount: number;
		newBalance: number;
		merchantContext: MerchantContext;
		description?: string;
		reference?: string;
		redemptionMethod?: "code" | "card_number" | "track_data" | "qr" | "manual";
		linkedTransactionId?: Id<"transactions">;
		feeAmount?: number;
	},
): Promise<Doc<"transactions">> {
	const {
		card,
		type,
		amount,
		newBalance,
		merchantContext,
		description,
		reference,
		redemptionMethod,
		linkedTransactionId,
		feeAmount,
	} = params;

	// Update card balance and lastUsedAt atomically
	await ctx.db.patch(card._id, {
		currentBalance: newBalance,
		lastUsedAt: Date.now(),
	});

	// Create transaction record
	const txnId = await ctx.db.insert("transactions", {
		merchantId: card.merchantId,
		cardId: card._id,
		customerId: card.customerId,
		type,
		amount,
		balanceBefore: card.currentBalance,
		balanceAfter: newBalance,
		currency: card.currency,
		description,
		reference,
		performedBy: merchantContext.user._id,
		performedByType: "user",
		redemptionMethod,
		linkedTransactionId,
		feeAmount,
	});

	const txn = await ctx.db.get(txnId);
	return txn!;
}

// ─── Mutations ─────────────────────────────────────────────────────

/**
 * Load funds onto a card (add balance).
 */
export const load = mutation({
	args: {
		...merchantScopeArgs,
		cardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);
		const { merchant } = merchantCtx;

		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Load amount must be greater than zero");
		}

		const minLoad = merchant.settings?.minLoadAmount ?? DEFAULT_MIN_LOAD_AMOUNT;
		const maxLoad = merchant.settings?.maxLoadAmount ?? DEFAULT_MAX_LOAD_AMOUNT;
		if (args.amount < minLoad) {
			invalidAmount(`Load amount must be at least ${minLoad} cents`);
		}
		if (args.amount > maxLoad) {
			invalidAmount(`Load amount must not exceed ${maxLoad} cents`);
		}

		const maxBalance = merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		const newBalance = card.currentBalance + args.amount;
		if (newBalance > maxBalance) {
			invalidAmount(
				`New balance would exceed maximum allowed (${maxBalance} cents)`,
			);
		}

		return await recordTransaction(ctx, {
			card,
			type: "load",
			amount: args.amount,
			newBalance,
			merchantContext: merchantCtx,
			description: args.description ?? "Funds loaded",
			reference: args.reference,
		});
	},
});

/**
 * Redeem (deduct) funds from a card by card ID.
 */
export const redeem = mutation({
	args: {
		...merchantScopeArgs,
		cardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			merchantContext: merchantCtx,
			description: args.description ?? "Funds redeemed",
			reference: args.reference,
			redemptionMethod: "manual",
		});
	},
});

/**
 * Redeem using a redemption code. Hash the code, look up via codeHash index.
 */
export const redeemByCode = mutation({
	args: {
		...merchantScopeArgs,
		code: v.string(),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		const codeHash = await sha256(args.code);

		const card = await ctx.db
			.query("cards")
			.withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
			.unique();

		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			merchantContext: merchantCtx,
			description: args.description ?? "Funds redeemed by code",
			reference: args.reference,
			redemptionMethod: "code",
		});
	},
});

/**
 * Redeem using magnetic stripe track data.
 * Hash the track data and look up via trackDataHash index.
 */
export const redeemByTrackData = mutation({
	args: {
		...merchantScopeArgs,
		trackData: v.string(),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		const trackDataHash = await sha256(args.trackData);

		const card = await ctx.db
			.query("cards")
			.withIndex("by_trackDataHash", (q) =>
				q.eq("trackDataHash", trackDataHash),
			)
			.unique();

		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			merchantContext: merchantCtx,
			description: args.description ?? "Funds redeemed by track data",
			reference: args.reference,
			redemptionMethod: "track_data",
		});
	},
});

/**
 * Transfer balance between two cards on the same merchant.
 * Creates two linked transactions: transfer_out on source, transfer_in on destination.
 */
export const transfer = mutation({
	args: {
		...merchantScopeArgs,
		fromCardId: v.id("cards"),
		toCardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: v.object({
		transferOut: transactionValidator,
		transferIn: transactionValidator,
	}),
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		if (args.fromCardId === args.toCardId) {
			validationError("Cannot transfer to the same card");
		}

		const fromCard = await ctx.db.get(args.fromCardId);
		if (!fromCard) {
			notFound("Source card");
		}
		if (fromCard.merchantId !== args.merchantId) {
			forbidden("Source card does not belong to this merchant");
		}

		const toCard = await ctx.db.get(args.toCardId);
		if (!toCard) {
			notFound("Destination card");
		}
		if (toCard.merchantId !== args.merchantId) {
			forbidden("Destination card does not belong to this merchant");
		}

		validateCardUsable(fromCard);
		validateCardUsable(toCard);

		if (args.amount <= 0) {
			invalidAmount("Transfer amount must be greater than zero");
		}
		if (args.amount > fromCard.currentBalance) {
			insufficientBalance();
		}

		// Check destination won't exceed max balance
		const maxBalance =
			merchantCtx.merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		const toNewBalance = toCard.currentBalance + args.amount;
		if (toNewBalance > maxBalance) {
			invalidAmount(
				`Transfer would cause destination card to exceed maximum balance (${maxBalance} cents)`,
			);
		}

		const fromNewBalance = fromCard.currentBalance - args.amount;
		const desc = args.description ?? "Balance transfer";

		// Debit source card
		await ctx.db.patch(args.fromCardId, {
			currentBalance: fromNewBalance,
			lastUsedAt: Date.now(),
		});
		const transferOutId = await ctx.db.insert("transactions", {
			merchantId: args.merchantId,
			cardId: args.fromCardId,
			customerId: fromCard.customerId,
			type: "transfer_out",
			amount: args.amount,
			balanceBefore: fromCard.currentBalance,
			balanceAfter: fromNewBalance,
			currency: fromCard.currency,
			description: desc,
			reference: args.reference,
			performedBy: merchantCtx.user._id,
			performedByType: "user",
		});

		// Credit destination card
		await ctx.db.patch(args.toCardId, {
			currentBalance: toNewBalance,
			lastUsedAt: Date.now(),
		});
		const transferInId = await ctx.db.insert("transactions", {
			merchantId: args.merchantId,
			cardId: args.toCardId,
			customerId: toCard.customerId,
			type: "transfer_in",
			amount: args.amount,
			balanceBefore: toCard.currentBalance,
			balanceAfter: toNewBalance,
			currency: toCard.currency,
			description: desc,
			reference: args.reference,
			performedBy: merchantCtx.user._id,
			performedByType: "user",
			linkedTransactionId: transferOutId,
		});

		// Link the transfer_out to the transfer_in
		await ctx.db.patch(transferOutId, {
			linkedTransactionId: transferInId,
		});

		const transferOut = await ctx.db.get(transferOutId);
		const transferIn = await ctx.db.get(transferInId);

		return {
			transferOut: transferOut!,
			transferIn: transferIn!,
		};
	},
});

/**
 * Manual balance adjustment. Can be positive or negative.
 * Requires merchant owner or admin role.
 */
export const adjust = mutation({
	args: {
		...merchantScopeArgs,
		cardId: v.id("cards"),
		amount: v.number(),
		reason: v.string(),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		// Only owner or admin can perform adjustments
		if (
			merchantCtx.memberRole !== "owner" &&
			merchantCtx.memberRole !== "admin"
		) {
			forbidden("Only merchant owner or admin can perform balance adjustments");
		}

		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		if (args.amount === 0) {
			invalidAmount("Adjustment amount cannot be zero");
		}

		const newBalance = card.currentBalance + args.amount;
		if (newBalance < 0) {
			invalidAmount("Adjustment would result in a negative balance");
		}

		const maxBalance =
			merchantCtx.merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		if (newBalance > maxBalance) {
			invalidAmount(
				`Adjustment would exceed maximum balance (${maxBalance} cents)`,
			);
		}

		return await recordTransaction(ctx, {
			card,
			type: "adjust",
			amount: args.amount,
			newBalance,
			merchantContext: merchantCtx,
			description: `Adjustment: ${args.reason}`,
			reference: args.reference,
		});
	},
});

/**
 * Refund a previous redemption transaction.
 * Looks up the original transaction and adds the amount back to the card.
 */
export const refund = mutation({
	args: {
		...merchantScopeArgs,
		transactionId: v.id("transactions"),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
	},
	returns: transactionValidator,
	handler: async (ctx, args) => {
		const merchantCtx = await withMerchant(ctx, args.merchantId);

		const originalTxn = await ctx.db.get(args.transactionId);
		if (!originalTxn) {
			notFound("Transaction");
		}
		if (originalTxn.merchantId !== args.merchantId) {
			forbidden("Transaction does not belong to this merchant");
		}
		if (originalTxn.type !== "redeem") {
			validationError("Only redemption transactions can be refunded");
		}

		// Check if already refunded (look for existing refund linked to this txn)
		const existingRefund = await ctx.db
			.query("transactions")
			.withIndex("by_cardId", (q) => q.eq("cardId", originalTxn.cardId))
			.collect();

		const alreadyRefunded = existingRefund.some(
			(t) =>
				t.type === "refund" &&
				t.linkedTransactionId === args.transactionId,
		);
		if (alreadyRefunded) {
			validationError("This transaction has already been refunded");
		}

		const card = await ctx.db.get(originalTxn.cardId);
		if (!card) {
			notFound("Card");
		}

		const newBalance = card.currentBalance + originalTxn.amount;

		const maxBalance =
			merchantCtx.merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		if (newBalance > maxBalance) {
			invalidAmount(
				`Refund would exceed maximum card balance (${maxBalance} cents)`,
			);
		}

		return await recordTransaction(ctx, {
			card,
			type: "refund",
			amount: originalTxn.amount,
			newBalance,
			merchantContext: merchantCtx,
			description:
				args.description ?? `Refund for transaction ${args.transactionId}`,
			reference: args.reference,
			linkedTransactionId: args.transactionId,
		});
	},
});

// ─── Queries ───────────────────────────────────────────────────────

/**
 * List transactions for a specific card.
 */
export const listByCard = query({
	args: {
		cardId: v.id("cards"),
	},
	returns: v.array(transactionValidator),
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}

		await withMerchant(ctx, card.merchantId);

		return await ctx.db
			.query("transactions")
			.withIndex("by_cardId", (q) => q.eq("cardId", args.cardId))
			.order("desc")
			.collect();
	},
});

/**
 * Paginated transactions for a merchant. Optional type filter.
 */
export const listByMerchant = query({
	args: {
		...merchantScopeArgs,
		type: v.optional(
			v.union(
				v.literal("load"),
				v.literal("redeem"),
				v.literal("transfer_in"),
				v.literal("transfer_out"),
				v.literal("adjust"),
				v.literal("refund"),
			),
		),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		page: v.array(transactionValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		if (args.type) {
			return await ctx.db
				.query("transactions")
				.withIndex("by_merchantId_and_type", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("type", args.type!),
				)
				.order("desc")
				.paginate(args.paginationOpts);
		}

		return await ctx.db
			.query("transactions")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

/**
 * List transactions for a customer.
 */
export const listByCustomer = query({
	args: {
		customerId: v.id("customers"),
	},
	returns: v.array(transactionValidator),
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			notFound("Customer");
		}

		await withMerchant(ctx, customer.merchantId);

		return await ctx.db
			.query("transactions")
			.withIndex("by_customerId", (q) =>
				q.eq("customerId", args.customerId),
			)
			.order("desc")
			.collect();
	},
});

/**
 * Get a single transaction by ID.
 */
export const getById = query({
	args: {
		transactionId: v.id("transactions"),
	},
	returns: v.union(transactionValidator, v.null()),
	handler: async (ctx, args) => {
		const txn = await ctx.db.get(args.transactionId);
		if (!txn) {
			return null;
		}

		await withMerchant(ctx, txn.merchantId);

		return txn;
	},
});

// ─── Internal Functions (API-facing, no user auth) ─────────────────

/**
 * Helper to record a transaction via API key (no user auth).
 * Uses "api_key" as performedByType and the apiKeyId as performedBy.
 */
async function recordApiTransaction(
	ctx: { db: any },
	params: {
		card: Doc<"cards">;
		type: "load" | "redeem" | "transfer_in" | "transfer_out" | "adjust" | "refund";
		amount: number;
		newBalance: number;
		apiKeyId: string;
		description?: string;
		reference?: string;
		redemptionMethod?: "code" | "card_number" | "track_data" | "qr" | "manual";
		linkedTransactionId?: Id<"transactions">;
		feeAmount?: number;
	},
): Promise<Doc<"transactions">> {
	const {
		card,
		type,
		amount,
		newBalance,
		apiKeyId,
		description,
		reference,
		redemptionMethod,
		linkedTransactionId,
		feeAmount,
	} = params;

	await ctx.db.patch(card._id, {
		currentBalance: newBalance,
		lastUsedAt: Date.now(),
	});

	const txnId = await ctx.db.insert("transactions", {
		merchantId: card.merchantId,
		cardId: card._id,
		customerId: card.customerId,
		type,
		amount,
		balanceBefore: card.currentBalance,
		balanceAfter: newBalance,
		currency: card.currency,
		description,
		reference,
		performedBy: apiKeyId,
		performedByType: "api_key" as const,
		redemptionMethod,
		linkedTransactionId,
		feeAmount,
	});

	const txn = await ctx.db.get(txnId);
	return txn!;
}

/**
 * Load funds via API key (no user auth).
 */
export const apiLoad = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		cardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
		apiKeyId: v.string(),
	},
	handler: async (ctx, args) => {
		const merchant = await ctx.db.get(args.merchantId);
		if (!merchant) {
			notFound("Merchant");
		}

		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Load amount must be greater than zero");
		}

		const minLoad = merchant.settings?.minLoadAmount ?? DEFAULT_MIN_LOAD_AMOUNT;
		const maxLoad = merchant.settings?.maxLoadAmount ?? DEFAULT_MAX_LOAD_AMOUNT;
		if (args.amount < minLoad) {
			invalidAmount(`Load amount must be at least ${minLoad} cents`);
		}
		if (args.amount > maxLoad) {
			invalidAmount(`Load amount must not exceed ${maxLoad} cents`);
		}

		const maxBalance = merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		const newBalance = card.currentBalance + args.amount;
		if (newBalance > maxBalance) {
			invalidAmount(
				`New balance would exceed maximum allowed (${maxBalance} cents)`,
			);
		}

		return await recordApiTransaction(ctx, {
			card,
			type: "load",
			amount: args.amount,
			newBalance,
			apiKeyId: args.apiKeyId,
			description: args.description ?? "Funds loaded via API",
			reference: args.reference,
		});
	},
});

/**
 * Redeem by card ID via API key (no user auth).
 */
export const apiRedeem = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		cardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
		apiKeyId: v.string(),
	},
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordApiTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			apiKeyId: args.apiKeyId,
			description: args.description ?? "Funds redeemed via API",
			reference: args.reference,
			redemptionMethod: "manual",
		});
	},
});

/**
 * Redeem by code via API key (no user auth).
 */
export const apiRedeemByCode = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		code: v.string(),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
		apiKeyId: v.string(),
	},
	handler: async (ctx, args) => {
		const codeHash = await sha256(args.code);

		const card = await ctx.db
			.query("cards")
			.withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
			.unique();

		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordApiTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			apiKeyId: args.apiKeyId,
			description: args.description ?? "Funds redeemed by code via API",
			reference: args.reference,
			redemptionMethod: "code",
		});
	},
});

/**
 * Redeem by track data via API key (no user auth).
 */
export const apiRedeemByTrackData = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		trackData: v.string(),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
		apiKeyId: v.string(),
	},
	handler: async (ctx, args) => {
		const trackDataHash = await sha256(args.trackData);

		const card = await ctx.db
			.query("cards")
			.withIndex("by_trackDataHash", (q) =>
				q.eq("trackDataHash", trackDataHash),
			)
			.unique();

		if (!card) {
			notFound("Card");
		}
		if (card.merchantId !== args.merchantId) {
			forbidden("Card does not belong to this merchant");
		}

		validateCardUsable(card);

		if (args.amount <= 0) {
			invalidAmount("Redeem amount must be greater than zero");
		}
		if (args.amount > card.currentBalance) {
			insufficientBalance();
		}

		const newBalance = card.currentBalance - args.amount;

		return await recordApiTransaction(ctx, {
			card,
			type: "redeem",
			amount: args.amount,
			newBalance,
			apiKeyId: args.apiKeyId,
			description: args.description ?? "Funds redeemed by track data via API",
			reference: args.reference,
			redemptionMethod: "track_data",
		});
	},
});

/**
 * Transfer balance via API key (no user auth).
 */
export const apiTransfer = internalMutation({
	args: {
		merchantId: v.id("merchants"),
		fromCardId: v.id("cards"),
		toCardId: v.id("cards"),
		amount: v.number(),
		description: v.optional(v.string()),
		reference: v.optional(v.string()),
		apiKeyId: v.string(),
	},
	handler: async (ctx, args) => {
		const merchant = await ctx.db.get(args.merchantId);
		if (!merchant) {
			notFound("Merchant");
		}

		if (args.fromCardId === args.toCardId) {
			validationError("Cannot transfer to the same card");
		}

		const fromCard = await ctx.db.get(args.fromCardId);
		if (!fromCard) {
			notFound("Source card");
		}
		if (fromCard.merchantId !== args.merchantId) {
			forbidden("Source card does not belong to this merchant");
		}

		const toCard = await ctx.db.get(args.toCardId);
		if (!toCard) {
			notFound("Destination card");
		}
		if (toCard.merchantId !== args.merchantId) {
			forbidden("Destination card does not belong to this merchant");
		}

		validateCardUsable(fromCard);
		validateCardUsable(toCard);

		if (args.amount <= 0) {
			invalidAmount("Transfer amount must be greater than zero");
		}
		if (args.amount > fromCard.currentBalance) {
			insufficientBalance();
		}

		const maxBalance =
			merchant.settings?.maxCardBalance ?? DEFAULT_MAX_CARD_BALANCE;
		const toNewBalance = toCard.currentBalance + args.amount;
		if (toNewBalance > maxBalance) {
			invalidAmount(
				`Transfer would cause destination card to exceed maximum balance (${maxBalance} cents)`,
			);
		}

		const fromNewBalance = fromCard.currentBalance - args.amount;
		const desc = args.description ?? "Balance transfer via API";

		// Debit source card
		await ctx.db.patch(args.fromCardId, {
			currentBalance: fromNewBalance,
			lastUsedAt: Date.now(),
		});
		const transferOutId = await ctx.db.insert("transactions", {
			merchantId: args.merchantId,
			cardId: args.fromCardId,
			customerId: fromCard.customerId,
			type: "transfer_out" as const,
			amount: args.amount,
			balanceBefore: fromCard.currentBalance,
			balanceAfter: fromNewBalance,
			currency: fromCard.currency,
			description: desc,
			reference: args.reference,
			performedBy: args.apiKeyId,
			performedByType: "api_key" as const,
		});

		// Credit destination card
		await ctx.db.patch(args.toCardId, {
			currentBalance: toNewBalance,
			lastUsedAt: Date.now(),
		});
		const transferInId = await ctx.db.insert("transactions", {
			merchantId: args.merchantId,
			cardId: args.toCardId,
			customerId: toCard.customerId,
			type: "transfer_in" as const,
			amount: args.amount,
			balanceBefore: toCard.currentBalance,
			balanceAfter: toNewBalance,
			currency: toCard.currency,
			description: desc,
			reference: args.reference,
			performedBy: args.apiKeyId,
			performedByType: "api_key" as const,
			linkedTransactionId: transferOutId,
		});

		// Link the transfer_out to the transfer_in
		await ctx.db.patch(transferOutId, {
			linkedTransactionId: transferInId,
		});

		const transferOut = await ctx.db.get(transferOutId);
		const transferIn = await ctx.db.get(transferInId);

		return {
			transferOut: transferOut!,
			transferIn: transferIn!,
		};
	},
});

/**
 * List transactions for a merchant via API key (no user auth).
 */
export const apiListByMerchant = internalQuery({
	args: {
		merchantId: v.id("merchants"),
		type: v.optional(
			v.union(
				v.literal("load"),
				v.literal("redeem"),
				v.literal("transfer_in"),
				v.literal("transfer_out"),
				v.literal("adjust"),
				v.literal("refund"),
			),
		),
		paginationOpts: v.object({
			cursor: v.union(v.string(), v.null()),
			numItems: v.number(),
		}),
	},
	handler: async (ctx, args) => {
		if (args.type) {
			return await ctx.db
				.query("transactions")
				.withIndex("by_merchantId_and_type", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("type", args.type!),
				)
				.order("desc")
				.paginate(args.paginationOpts);
		}

		return await ctx.db
			.query("transactions")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

/**
 * Get a single transaction by ID via API key (no user auth).
 */
export const apiGetById = internalQuery({
	args: {
		transactionId: v.id("transactions"),
		merchantId: v.optional(v.id("merchants")),
	},
	handler: async (ctx, args) => {
		const txn = await ctx.db.get(args.transactionId);
		if (!txn) {
			return null;
		}

		if (args.merchantId && txn.merchantId !== args.merchantId) {
			return null;
		}

		return txn;
	},
});
