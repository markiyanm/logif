import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
	query,
	mutation,
	internalQuery,
	internalMutation,
} from "./_generated/server.js";
import { withAuth, withAdmin } from "./lib/middleware.js";
import { notFound } from "./lib/errors.js";

// ─── Internal Functions ────────────────────────────────────────────

/**
 * Upsert a user on WorkOS auth callback.
 * Creates the user if they don't exist, updates lastLoginAt if they do.
 */
export const getOrCreateUser = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.string(),
		avatarUrl: v.optional(v.string()),
	},
	returns: v.id("users"),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", args.tokenIdentifier),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				lastLoginAt: Date.now(),
			});
			return existing._id;
		}

		const userId = await ctx.db.insert("users", {
			tokenIdentifier: args.tokenIdentifier,
			email: args.email,
			name: args.name,
			avatarUrl: args.avatarUrl,
			role: "customer",
			status: "active",
			lastLoginAt: Date.now(),
		});

		return userId;
	},
});

/**
 * Internal lookup by tokenIdentifier.
 */
export const getUserByTokenIdentifier = internalQuery({
	args: {
		tokenIdentifier: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("users"),
			_creationTime: v.number(),
			tokenIdentifier: v.string(),
			email: v.string(),
			name: v.string(),
			avatarUrl: v.optional(v.string()),
			role: v.union(
				v.literal("admin"),
				v.literal("partner"),
				v.literal("merchant"),
				v.literal("customer"),
			),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			lastLoginAt: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", args.tokenIdentifier),
			)
			.unique();

		return user;
	},
});

// ─── Public Mutations ──────────────────────────────────────────────

/**
 * Ensure the currently authenticated user exists in the database.
 * Creates them if they don't exist yet (first login).
 * Returns the user record.
 */
export const ensureCurrentUser = mutation({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id("users"),
			_creationTime: v.number(),
			tokenIdentifier: v.string(),
			email: v.string(),
			name: v.string(),
			avatarUrl: v.optional(v.string()),
			role: v.union(
				v.literal("admin"),
				v.literal("partner"),
				v.literal("merchant"),
				v.literal("customer"),
			),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			lastLoginAt: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}

		const existing = await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", identity.tokenIdentifier),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				lastLoginAt: Date.now(),
			});
			return existing;
		}

		const userId = await ctx.db.insert("users", {
			tokenIdentifier: identity.tokenIdentifier,
			email: identity.email ?? "",
			name: identity.name ?? identity.email ?? "Unknown",
			avatarUrl: identity.pictureUrl ?? undefined,
			role: "customer",
			status: "active",
			lastLoginAt: Date.now(),
		});

		return await ctx.db.get(userId);
	},
});

// ─── Public Queries ────────────────────────────────────────────────

/**
 * Get the currently authenticated user from auth identity.
 * Returns null if not authenticated or user not found.
 */
export const getCurrentUser = query({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id("users"),
			_creationTime: v.number(),
			tokenIdentifier: v.string(),
			email: v.string(),
			name: v.string(),
			avatarUrl: v.optional(v.string()),
			role: v.union(
				v.literal("admin"),
				v.literal("partner"),
				v.literal("merchant"),
				v.literal("customer"),
			),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			lastLoginAt: v.optional(v.number()),
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

		return user;
	},
});

/**
 * Admin-only paginated user list.
 */
export const listUsers = query({
	args: {
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		page: v.array(
			v.object({
				_id: v.id("users"),
				_creationTime: v.number(),
				tokenIdentifier: v.string(),
				email: v.string(),
				name: v.string(),
				avatarUrl: v.optional(v.string()),
				role: v.union(
					v.literal("admin"),
					v.literal("partner"),
					v.literal("merchant"),
					v.literal("customer"),
				),
				status: v.union(
					v.literal("active"),
					v.literal("suspended"),
					v.literal("pending"),
				),
				lastLoginAt: v.optional(v.number()),
			}),
		),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		return await ctx.db
			.query("users")
			.order("desc")
			.paginate(args.paginationOpts);
	},
});

/**
 * Admin-only get user by ID.
 */
export const getUserById = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(
		v.object({
			_id: v.id("users"),
			_creationTime: v.number(),
			tokenIdentifier: v.string(),
			email: v.string(),
			name: v.string(),
			avatarUrl: v.optional(v.string()),
			role: v.union(
				v.literal("admin"),
				v.literal("partner"),
				v.literal("merchant"),
				v.literal("customer"),
			),
			status: v.union(
				v.literal("active"),
				v.literal("suspended"),
				v.literal("pending"),
			),
			lastLoginAt: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		const user = await ctx.db.get(args.userId);
		return user;
	},
});

// ─── Mutations ─────────────────────────────────────────────────────

/**
 * Update own profile (name, avatarUrl).
 */
export const updateProfile = mutation({
	args: {
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		const updates: { name?: string; avatarUrl?: string } = {};
		if (args.name !== undefined) {
			updates.name = args.name;
		}
		if (args.avatarUrl !== undefined) {
			updates.avatarUrl = args.avatarUrl;
		}

		await ctx.db.patch(user._id, updates);
		return null;
	},
});

/**
 * Admin-only: update a user's role.
 */
export const updateUserRole = mutation({
	args: {
		userId: v.id("users"),
		role: v.union(
			v.literal("admin"),
			v.literal("partner"),
			v.literal("merchant"),
			v.literal("customer"),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		const user = await ctx.db.get(args.userId);
		if (!user) {
			notFound("User");
		}

		await ctx.db.patch(args.userId, { role: args.role });
		return null;
	},
});

/**
 * Admin-only: suspend a user.
 */
export const suspendUser = mutation({
	args: {
		userId: v.id("users"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withAdmin(ctx);

		const user = await ctx.db.get(args.userId);
		if (!user) {
			notFound("User");
		}

		await ctx.db.patch(args.userId, { status: "suspended" });
		return null;
	},
});
