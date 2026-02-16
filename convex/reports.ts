import { v } from "convex/values";
import { query } from "./_generated/server.js";
import {
	withMerchant,
	withAdmin,
	withPartner,
} from "./lib/middleware.js";

// ─── Merchant Dashboard (Query) ─────────────────────────────────────

/**
 * Dashboard aggregations for the merchant portal.
 * Returns: total cards by status, transaction volume by type,
 * recent transactions, top customers by spend.
 */
export const getMerchantDashboard = query({
	args: {
		merchantId: v.id("merchants"),
	},
	returns: v.object({
		cardsByStatus: v.object({
			active: v.number(),
			inactive: v.number(),
			suspended: v.number(),
			expired: v.number(),
			cancelled: v.number(),
		}),
		transactionVolume: v.object({
			load: v.number(),
			redeem: v.number(),
			transfer_in: v.number(),
			transfer_out: v.number(),
			adjust: v.number(),
			refund: v.number(),
		}),
		recentTransactions: v.array(
			v.object({
				_id: v.id("transactions"),
				_creationTime: v.number(),
				type: v.union(
					v.literal("load"),
					v.literal("redeem"),
					v.literal("transfer_in"),
					v.literal("transfer_out"),
					v.literal("adjust"),
					v.literal("refund"),
				),
				amount: v.number(),
				currency: v.string(),
				cardId: v.id("cards"),
				description: v.optional(v.string()),
			}),
		),
		topCustomers: v.array(
			v.object({
				_id: v.id("customers"),
				name: v.optional(v.string()),
				email: v.string(),
				totalSpent: v.number(),
				cardCount: v.number(),
			}),
		),
		totalBalance: v.number(),
		totalCards: v.number(),
		totalCustomers: v.number(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		// Cards by status
		const allCards = await ctx.db
			.query("cards")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.collect();

		const cardsByStatus = {
			active: 0,
			inactive: 0,
			suspended: 0,
			expired: 0,
			cancelled: 0,
		};
		let totalBalance = 0;

		for (const card of allCards) {
			cardsByStatus[card.status]++;
			if (card.status === "active") {
				totalBalance += card.currentBalance;
			}
		}

		// Transaction volume by type
		const transactionVolume = {
			load: 0,
			redeem: 0,
			transfer_in: 0,
			transfer_out: 0,
			adjust: 0,
			refund: 0,
		};

		const txTypes = [
			"load",
			"redeem",
			"transfer_in",
			"transfer_out",
			"adjust",
			"refund",
		] as const;

		for (const txType of txTypes) {
			const txns = await ctx.db
				.query("transactions")
				.withIndex("by_merchantId_and_type", (q) =>
					q
						.eq("merchantId", args.merchantId)
						.eq("type", txType),
				)
				.collect();

			transactionVolume[txType] = txns.reduce(
				(sum, tx) => sum + Math.abs(tx.amount),
				0,
			);
		}

		// Recent transactions (last 10)
		const recentTxns = await ctx.db
			.query("transactions")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.take(10);

		const recentTransactions = recentTxns.map((tx) => ({
			_id: tx._id,
			_creationTime: tx._creationTime,
			type: tx.type,
			amount: tx.amount,
			currency: tx.currency,
			cardId: tx.cardId,
			description: tx.description,
		}));

		// Top customers by spend (top 10)
		const customers = await ctx.db
			.query("customers")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.collect();

		const sortedCustomers = customers
			.sort((a, b) => b.totalSpent - a.totalSpent)
			.slice(0, 10);

		const topCustomers = sortedCustomers.map((c) => ({
			_id: c._id,
			name: c.name,
			email: c.email,
			totalSpent: c.totalSpent,
			cardCount: c.cardCount,
		}));

		return {
			cardsByStatus,
			transactionVolume,
			recentTransactions,
			topCustomers,
			totalBalance,
			totalCards: allCards.length,
			totalCustomers: customers.length,
		};
	},
});

// ─── Admin Dashboard (Query) ────────────────────────────────────────

/**
 * Platform-wide stats for admin dashboard.
 * Total merchants, partners, users, cards, transaction volume.
 */
export const getAdminDashboard = query({
	args: {},
	returns: v.object({
		totalMerchants: v.number(),
		activeMerchants: v.number(),
		totalPartners: v.number(),
		activePartners: v.number(),
		totalUsers: v.number(),
		totalCards: v.number(),
		activeCards: v.number(),
		totalTransactionVolume: v.number(),
		totalTransactionCount: v.number(),
		recentMerchants: v.array(
			v.object({
				_id: v.id("merchants"),
				name: v.string(),
				slug: v.string(),
				status: v.union(
					v.literal("active"),
					v.literal("suspended"),
					v.literal("pending"),
				),
				_creationTime: v.number(),
			}),
		),
	}),
	handler: async (ctx) => {
		await withAdmin(ctx);

		// Merchant counts
		const allMerchants = await ctx.db.query("merchants").collect();
		const totalMerchants = allMerchants.length;
		const activeMerchants = allMerchants.filter(
			(m) => m.status === "active",
		).length;

		// Partner counts
		const allPartners = await ctx.db.query("partners").collect();
		const totalPartners = allPartners.length;
		const activePartners = allPartners.filter(
			(p) => p.status === "active",
		).length;

		// User count
		const allUsers = await ctx.db.query("users").collect();
		const totalUsers = allUsers.length;

		// Card counts
		const allCards = await ctx.db.query("cards").collect();
		const totalCards = allCards.length;
		const activeCards = allCards.filter(
			(c) => c.status === "active",
		).length;

		// Transaction stats
		const allTransactions = await ctx.db.query("transactions").collect();
		const totalTransactionCount = allTransactions.length;
		const totalTransactionVolume = allTransactions.reduce(
			(sum, tx) => sum + Math.abs(tx.amount),
			0,
		);

		// Recent merchants (last 10)
		const recentMerchants = allMerchants
			.sort((a, b) => b._creationTime - a._creationTime)
			.slice(0, 10)
			.map((m) => ({
				_id: m._id,
				name: m.name,
				slug: m.slug,
				status: m.status,
				_creationTime: m._creationTime,
			}));

		return {
			totalMerchants,
			activeMerchants,
			totalPartners,
			activePartners,
			totalUsers,
			totalCards,
			activeCards,
			totalTransactionVolume,
			totalTransactionCount,
			recentMerchants,
		};
	},
});

// ─── Partner Dashboard (Query) ──────────────────────────────────────

/**
 * Partner stats: merchant count, API usage, total volume across merchants.
 */
export const getPartnerDashboard = query({
	args: {
		partnerId: v.id("partners"),
	},
	returns: v.object({
		merchantCount: v.number(),
		activeMerchantCount: v.number(),
		totalApiKeys: v.number(),
		totalCards: v.number(),
		activeCards: v.number(),
		totalTransactionVolume: v.number(),
		totalTransactionCount: v.number(),
		merchants: v.array(
			v.object({
				_id: v.id("merchants"),
				name: v.string(),
				slug: v.string(),
				status: v.union(
					v.literal("active"),
					v.literal("suspended"),
					v.literal("pending"),
				),
				cardCount: v.number(),
				transactionVolume: v.number(),
			}),
		),
	}),
	handler: async (ctx, args) => {
		await withPartner(ctx, args.partnerId);

		// Get all merchants under this partner
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

		let totalCards = 0;
		let activeCards = 0;
		let totalTransactionVolume = 0;
		let totalTransactionCount = 0;

		const merchantStats = [];

		for (const merchant of merchants) {
			// Cards for this merchant
			const cards = await ctx.db
				.query("cards")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", merchant._id),
				)
				.collect();

			const merchantCardCount = cards.length;
			const merchantActiveCards = cards.filter(
				(c) => c.status === "active",
			).length;

			// Transactions for this merchant
			const transactions = await ctx.db
				.query("transactions")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", merchant._id),
				)
				.collect();

			const merchantTxVolume = transactions.reduce(
				(sum, tx) => sum + Math.abs(tx.amount),
				0,
			);

			totalCards += merchantCardCount;
			activeCards += merchantActiveCards;
			totalTransactionVolume += merchantTxVolume;
			totalTransactionCount += transactions.length;

			merchantStats.push({
				_id: merchant._id,
				name: merchant.name,
				slug: merchant.slug,
				status: merchant.status,
				cardCount: merchantCardCount,
				transactionVolume: merchantTxVolume,
			});
		}

		return {
			merchantCount,
			activeMerchantCount,
			totalApiKeys: apiKeys.length,
			totalCards,
			activeCards,
			totalTransactionVolume,
			totalTransactionCount,
			merchants: merchantStats,
		};
	},
});
