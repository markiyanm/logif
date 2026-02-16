import { v } from "convex/values";
import { query, mutation } from "./_generated/server.js";
import { withAuth } from "./lib/middleware.js";

// ─── Generate Upload URL (Mutation) ─────────────────────────────────

/**
 * Generate a Convex file upload URL.
 * Requires authentication.
 */
export const generateUploadUrl = mutation({
	args: {},
	returns: v.string(),
	handler: async (ctx) => {
		await withAuth(ctx);
		return await ctx.storage.generateUploadUrl();
	},
});

// ─── Get File URL (Query) ───────────────────────────────────────────

/**
 * Get a serving URL for a file.
 * Takes a storage ID and returns the URL.
 */
export const getFileUrl = query({
	args: {
		storageId: v.id("_storage"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		return await ctx.storage.getUrl(args.storageId);
	},
});
