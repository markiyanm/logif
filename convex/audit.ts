import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server.js";
import { withAuth, withMerchant, withAdmin } from "./lib/middleware.js";
import {
	paginationArgs,
	getPaginationOpts,
} from "./lib/validators.js";

// ─── Validators ─────────────────────────────────────────────────────

const auditLogValidator = v.object({
	_id: v.id("auditLogs"),
	_creationTime: v.number(),
	merchantId: v.optional(v.id("merchants")),
	userId: v.optional(v.id("users")),
	apiKeyId: v.optional(v.id("apiKeys")),
	action: v.string(),
	entityType: v.string(),
	entityId: v.string(),
	changes: v.optional(v.any()),
	ipAddress: v.optional(v.string()),
	userAgent: v.optional(v.string()),
});

// ─── Log (Internal Mutation) ────────────────────────────────────────

/**
 * Write an audit log entry.
 * Called internally by other functions whenever an auditable action occurs.
 */
export const log = internalMutation({
	args: {
		merchantId: v.optional(v.id("merchants")),
		userId: v.optional(v.id("users")),
		apiKeyId: v.optional(v.id("apiKeys")),
		action: v.string(),
		entityType: v.string(),
		entityId: v.string(),
		changes: v.optional(v.any()),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
	},
	returns: v.id("auditLogs"),
	handler: async (ctx, args) => {
		const auditLogId = await ctx.db.insert("auditLogs", {
			merchantId: args.merchantId,
			userId: args.userId,
			apiKeyId: args.apiKeyId,
			action: args.action,
			entityType: args.entityType,
			entityId: args.entityId,
			changes: args.changes,
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
		});

		return auditLogId;
	},
});

// ─── List by Merchant (Query) ───────────────────────────────────────

/**
 * Paginated audit logs for a merchant.
 */
export const listByMerchant = query({
	args: {
		merchantId: v.id("merchants"),
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(auditLogValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);
		const paginationOpts = getPaginationOpts(args);

		return await ctx.db
			.query("auditLogs")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.order("desc")
			.paginate(paginationOpts);
	},
});

// ─── List by User (Query) ───────────────────────────────────────────

/**
 * Paginated audit logs for a specific user. Admin only.
 */
export const listByUser = query({
	args: {
		userId: v.id("users"),
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(auditLogValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withAdmin(ctx);
		const paginationOpts = getPaginationOpts(args);

		return await ctx.db
			.query("auditLogs")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.order("desc")
			.paginate(paginationOpts);
	},
});

// ─── List by Entity (Query) ─────────────────────────────────────────

/**
 * Audit logs for a specific entity (e.g., a card, merchant, user).
 */
export const listByEntity = query({
	args: {
		entityType: v.string(),
		entityId: v.string(),
		...paginationArgs,
	},
	returns: v.object({
		page: v.array(auditLogValidator),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withAuth(ctx);
		const paginationOpts = getPaginationOpts(args);

		return await ctx.db
			.query("auditLogs")
			.withIndex("by_entityType_and_entityId", (q) =>
				q
					.eq("entityType", args.entityType)
					.eq("entityId", args.entityId),
			)
			.order("desc")
			.paginate(paginationOpts);
	},
});
