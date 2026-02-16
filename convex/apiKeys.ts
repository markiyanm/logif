import { v } from "convex/values";
import {
	query,
	mutation,
	internalMutation,
} from "./_generated/server.js";
import { Id } from "./_generated/dataModel.js";
import { withAuth, withMerchant, withPartner } from "./lib/middleware.js";
import {
	notFound,
	validationError,
	unauthorized,
	forbidden,
	rateLimited,
} from "./lib/errors.js";
import { sha256, generateRandomString } from "./lib/crypto.js";
import { hasPermission } from "./lib/permissions.js";
import {
	API_KEY_PREFIX_LIVE,
	API_KEY_PREFIX_TEST,
	API_KEY_RANDOM_LENGTH,
	DEFAULT_RATE_LIMIT_PER_MINUTE,
	DEFAULT_RATE_LIMIT_PER_DAY,
	API_PERMISSIONS,
} from "./lib/constants.js";

// ─── Mutations ─────────────────────────────────────────────────────

/**
 * Create a new API key.
 * Generates the key string, stores only the SHA-256 hash.
 * Returns the plaintext key -- this is the only time it is shown.
 */
export const create = mutation({
	args: {
		name: v.string(),
		environment: v.union(v.literal("live"), v.literal("test")),
		permissions: v.array(v.string()),
		merchantId: v.optional(v.id("merchants")),
		partnerId: v.optional(v.id("partners")),
		rateLimitPerMinute: v.optional(v.number()),
		rateLimitPerDay: v.optional(v.number()),
		allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
		expiresAt: v.optional(v.number()),
	},
	returns: v.object({
		apiKeyId: v.id("apiKeys"),
		key: v.string(),
	}),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		// Validate that at least one scope is provided
		if (!args.merchantId && !args.partnerId) {
			validationError(
				"API key must be scoped to either a merchant or a partner",
			);
		}

		// Validate permissions are valid
		for (const perm of args.permissions) {
			if (
				!(API_PERMISSIONS as readonly string[]).includes(perm)
			) {
				validationError(`Invalid permission: ${perm}`);
			}
		}

		if (args.permissions.length === 0) {
			validationError("At least one permission is required");
		}

		// Verify access to the target merchant or partner
		if (args.merchantId) {
			await withMerchant(ctx, args.merchantId);
		}
		if (args.partnerId) {
			await withPartner(ctx, args.partnerId);
		}

		// Generate key string: prefix + random chars
		const prefix =
			args.environment === "live"
				? API_KEY_PREFIX_LIVE
				: API_KEY_PREFIX_TEST;
		const randomPart = generateRandomString(API_KEY_RANDOM_LENGTH);
		const plaintextKey = prefix + randomPart;

		// Store only the hash
		const keyHash = await sha256(plaintextKey);
		// Store a visible prefix for identification (e.g. "lgf_live_ABCD...")
		const keyPrefix = plaintextKey.substring(0, prefix.length + 8);

		const apiKeyId = await ctx.db.insert("apiKeys", {
			name: args.name,
			keyPrefix,
			keyHash,
			partnerId: args.partnerId,
			merchantId: args.merchantId,
			createdByUserId: user._id,
			permissions: args.permissions,
			environment: args.environment,
			status: "active",
			rateLimitPerMinute:
				args.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
			rateLimitPerDay:
				args.rateLimitPerDay ?? DEFAULT_RATE_LIMIT_PER_DAY,
			allowedMerchantIds: args.allowedMerchantIds,
			expiresAt: args.expiresAt,
		});

		return { apiKeyId, key: plaintextKey };
	},
});

/**
 * Get an API key by ID (without showing the plaintext key).
 */
export const getById = query({
	args: {
		apiKeyId: v.id("apiKeys"),
	},
	returns: v.union(
		v.object({
			_id: v.id("apiKeys"),
			_creationTime: v.number(),
			name: v.string(),
			keyPrefix: v.string(),
			partnerId: v.optional(v.id("partners")),
			merchantId: v.optional(v.id("merchants")),
			createdByUserId: v.id("users"),
			permissions: v.array(v.string()),
			environment: v.union(v.literal("live"), v.literal("test")),
			status: v.union(v.literal("active"), v.literal("revoked")),
			lastUsedAt: v.optional(v.number()),
			expiresAt: v.optional(v.number()),
			rateLimitPerMinute: v.number(),
			rateLimitPerDay: v.number(),
			allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		await withAuth(ctx);

		const apiKey = await ctx.db.get(args.apiKeyId);
		if (!apiKey) {
			return null;
		}

		// Return all fields except keyHash
		return {
			_id: apiKey._id,
			_creationTime: apiKey._creationTime,
			name: apiKey.name,
			keyPrefix: apiKey.keyPrefix,
			partnerId: apiKey.partnerId,
			merchantId: apiKey.merchantId,
			createdByUserId: apiKey.createdByUserId,
			permissions: apiKey.permissions,
			environment: apiKey.environment,
			status: apiKey.status,
			lastUsedAt: apiKey.lastUsedAt,
			expiresAt: apiKey.expiresAt,
			rateLimitPerMinute: apiKey.rateLimitPerMinute,
			rateLimitPerDay: apiKey.rateLimitPerDay,
			allowedMerchantIds: apiKey.allowedMerchantIds,
		};
	},
});

/**
 * List API keys for a merchant.
 */
export const listByMerchant = query({
	args: {
		merchantId: v.id("merchants"),
	},
	returns: v.array(
		v.object({
			_id: v.id("apiKeys"),
			_creationTime: v.number(),
			name: v.string(),
			keyPrefix: v.string(),
			partnerId: v.optional(v.id("partners")),
			merchantId: v.optional(v.id("merchants")),
			createdByUserId: v.id("users"),
			permissions: v.array(v.string()),
			environment: v.union(v.literal("live"), v.literal("test")),
			status: v.union(v.literal("active"), v.literal("revoked")),
			lastUsedAt: v.optional(v.number()),
			expiresAt: v.optional(v.number()),
			rateLimitPerMinute: v.number(),
			rateLimitPerDay: v.number(),
			allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
		}),
	),
	handler: async (ctx, args) => {
		await withMerchant(ctx, args.merchantId);

		const keys = await ctx.db
			.query("apiKeys")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.collect();

		// Exclude keyHash from results
		return keys.map((k) => ({
			_id: k._id,
			_creationTime: k._creationTime,
			name: k.name,
			keyPrefix: k.keyPrefix,
			partnerId: k.partnerId,
			merchantId: k.merchantId,
			createdByUserId: k.createdByUserId,
			permissions: k.permissions,
			environment: k.environment,
			status: k.status,
			lastUsedAt: k.lastUsedAt,
			expiresAt: k.expiresAt,
			rateLimitPerMinute: k.rateLimitPerMinute,
			rateLimitPerDay: k.rateLimitPerDay,
			allowedMerchantIds: k.allowedMerchantIds,
		}));
	},
});

/**
 * List API keys for a partner.
 */
export const listByPartner = query({
	args: {
		partnerId: v.id("partners"),
	},
	returns: v.array(
		v.object({
			_id: v.id("apiKeys"),
			_creationTime: v.number(),
			name: v.string(),
			keyPrefix: v.string(),
			partnerId: v.optional(v.id("partners")),
			merchantId: v.optional(v.id("merchants")),
			createdByUserId: v.id("users"),
			permissions: v.array(v.string()),
			environment: v.union(v.literal("live"), v.literal("test")),
			status: v.union(v.literal("active"), v.literal("revoked")),
			lastUsedAt: v.optional(v.number()),
			expiresAt: v.optional(v.number()),
			rateLimitPerMinute: v.number(),
			rateLimitPerDay: v.number(),
			allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
		}),
	),
	handler: async (ctx, args) => {
		await withPartner(ctx, args.partnerId);

		const keys = await ctx.db
			.query("apiKeys")
			.withIndex("by_partnerId", (q) =>
				q.eq("partnerId", args.partnerId),
			)
			.collect();

		return keys.map((k) => ({
			_id: k._id,
			_creationTime: k._creationTime,
			name: k.name,
			keyPrefix: k.keyPrefix,
			partnerId: k.partnerId,
			merchantId: k.merchantId,
			createdByUserId: k.createdByUserId,
			permissions: k.permissions,
			environment: k.environment,
			status: k.status,
			lastUsedAt: k.lastUsedAt,
			expiresAt: k.expiresAt,
			rateLimitPerMinute: k.rateLimitPerMinute,
			rateLimitPerDay: k.rateLimitPerDay,
			allowedMerchantIds: k.allowedMerchantIds,
		}));
	},
});

/**
 * Revoke an API key.
 */
export const revoke = mutation({
	args: {
		apiKeyId: v.id("apiKeys"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const { user } = await withAuth(ctx);

		const apiKey = await ctx.db.get(args.apiKeyId);
		if (!apiKey) {
			notFound("API key");
		}

		if (apiKey.status === "revoked") {
			validationError("API key is already revoked");
		}

		// Verify access: user must have access to the merchant or partner
		if (apiKey.merchantId) {
			await withMerchant(ctx, apiKey.merchantId);
		} else if (apiKey.partnerId) {
			await withPartner(ctx, apiKey.partnerId);
		} else if (user.role !== "admin") {
			forbidden("You do not have permission to revoke this API key");
		}

		await ctx.db.patch(args.apiKeyId, { status: "revoked" });
		return null;
	},
});

// ─── Internal Functions ────────────────────────────────────────────

/**
 * Validate an API key string from an HTTP request.
 * Hashes the input, looks up via by_keyHash index.
 * Checks status and expiration. Updates lastUsedAt.
 * Returns the API key document or throws.
 */
export const validateKey = internalMutation({
	args: {
		key: v.string(),
	},
	returns: v.object({
		_id: v.id("apiKeys"),
		_creationTime: v.number(),
		name: v.string(),
		keyPrefix: v.string(),
		keyHash: v.string(),
		partnerId: v.optional(v.id("partners")),
		merchantId: v.optional(v.id("merchants")),
		createdByUserId: v.id("users"),
		permissions: v.array(v.string()),
		environment: v.union(v.literal("live"), v.literal("test")),
		status: v.union(v.literal("active"), v.literal("revoked")),
		lastUsedAt: v.optional(v.number()),
		expiresAt: v.optional(v.number()),
		rateLimitPerMinute: v.number(),
		rateLimitPerDay: v.number(),
		allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
	}),
	handler: async (ctx, args) => {
		const keyHash = await sha256(args.key);

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

		// Update lastUsedAt
		await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() });

		return apiKey;
	},
});

/**
 * Check and increment rate limit for an API key.
 * Returns whether the request is allowed.
 */
export const checkRateLimit = internalMutation({
	args: {
		apiKeyId: v.id("apiKeys"),
		windowType: v.union(v.literal("minute"), v.literal("day")),
	},
	returns: v.object({
		allowed: v.boolean(),
		remaining: v.number(),
		limit: v.number(),
		resetAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const apiKey = await ctx.db.get(args.apiKeyId);
		if (!apiKey) {
			return { allowed: false, remaining: 0, limit: 0, resetAt: 0 };
		}

		const now = Date.now();
		const windowDurationMs =
			args.windowType === "minute" ? 60 * 1000 : 24 * 60 * 60 * 1000;
		const windowStart =
			Math.floor(now / windowDurationMs) * windowDurationMs;
		const resetAt = windowStart + windowDurationMs;

		const limit =
			args.windowType === "minute"
				? apiKey.rateLimitPerMinute
				: apiKey.rateLimitPerDay;

		// Look up or create the rate limit window
		const existing = await ctx.db
			.query("apiKeyRateLimits")
			.withIndex(
				"by_apiKeyId_and_windowType_and_windowStart",
				(q) =>
					q
						.eq("apiKeyId", args.apiKeyId)
						.eq("windowType", args.windowType)
						.eq("windowStart", windowStart),
			)
			.unique();

		if (existing) {
			if (existing.count >= limit) {
				return {
					allowed: false,
					remaining: 0,
					limit,
					resetAt,
				};
			}

			await ctx.db.patch(existing._id, {
				count: existing.count + 1,
			});

			return {
				allowed: true,
				remaining: limit - existing.count - 1,
				limit,
				resetAt,
			};
		}

		// Create new window
		await ctx.db.insert("apiKeyRateLimits", {
			apiKeyId: args.apiKeyId,
			windowType: args.windowType,
			windowStart,
			count: 1,
		});

		return {
			allowed: true,
			remaining: limit - 1,
			limit,
			resetAt,
		};
	},
});

/**
 * Delete old rate limit windows (for cron cleanup).
 * Removes windows older than 48 hours.
 */
export const cleanOldRateLimitWindows = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const cutoff = Date.now() - 48 * 60 * 60 * 1000;
		let deletedCount = 0;

		// Scan all rate limit windows and delete old ones
		const allWindows = await ctx.db
			.query("apiKeyRateLimits")
			.collect();

		for (const window of allWindows) {
			if (window.windowStart < cutoff) {
				await ctx.db.delete(window._id);
				deletedCount++;
			}
		}

		return deletedCount;
	},
});

/**
 * Log an API request to apiRequestLogs.
 */
export const logRequest = internalMutation({
	args: {
		apiKeyId: v.id("apiKeys"),
		merchantId: v.optional(v.id("merchants")),
		method: v.string(),
		path: v.string(),
		statusCode: v.number(),
		durationMs: v.number(),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.insert("apiRequestLogs", {
			apiKeyId: args.apiKeyId,
			merchantId: args.merchantId,
			method: args.method,
			path: args.path,
			statusCode: args.statusCode,
			durationMs: args.durationMs,
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
			errorMessage: args.errorMessage,
		});
		return null;
	},
});
