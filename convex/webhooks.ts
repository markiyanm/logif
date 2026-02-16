import { v } from "convex/values";
import {
	query,
	mutation,
	internalMutation,
	internalAction,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import {
	withAuth,
	withMerchant,
	withPartner,
} from "./lib/middleware.js";
import { notFound, forbidden, validationError } from "./lib/errors.js";
import { generateWebhookSecret } from "./lib/codeGenerator.js";
import { hmacSign } from "./lib/crypto.js";
import {
	WEBHOOK_MAX_RETRIES,
	WEBHOOK_AUTO_DISABLE_THRESHOLD,
	WEBHOOK_EVENTS,
} from "./lib/constants.js";

// ─── Validators ─────────────────────────────────────────────────────

const webhookEndpointValidator = v.object({
	_id: v.id("webhookEndpoints"),
	_creationTime: v.number(),
	merchantId: v.optional(v.id("merchants")),
	partnerId: v.optional(v.id("partners")),
	url: v.string(),
	secret: v.string(),
	events: v.array(v.string()),
	status: v.union(v.literal("active"), v.literal("disabled")),
	failureCount: v.number(),
	lastDeliveredAt: v.optional(v.number()),
	description: v.optional(v.string()),
});

// ─── Create Endpoint (Mutation) ─────────────────────────────────────

/**
 * Register a webhook endpoint.
 * Takes url, events array, merchantId or partnerId.
 * Generates secret via generateWebhookSecret().
 */
export const createEndpoint = mutation({
	args: {
		url: v.string(),
		events: v.array(v.string()),
		merchantId: v.optional(v.id("merchants")),
		partnerId: v.optional(v.id("partners")),
		description: v.optional(v.string()),
	},
	returns: webhookEndpointValidator,
	handler: async (ctx, args) => {
		await withAuth(ctx);

		if (!args.merchantId && !args.partnerId) {
			validationError(
				"Either merchantId or partnerId must be provided",
			);
		}

		// Validate that the user has access to the specified merchant or partner
		if (args.merchantId) {
			await withMerchant(ctx, args.merchantId);
		}
		if (args.partnerId) {
			await withPartner(ctx, args.partnerId);
		}

		// Validate URL format
		try {
			new URL(args.url);
		} catch {
			validationError("Invalid webhook URL");
		}

		// Validate events
		for (const event of args.events) {
			if (
				!WEBHOOK_EVENTS.includes(
					event as (typeof WEBHOOK_EVENTS)[number],
				)
			) {
				validationError(`Invalid webhook event: ${event}`);
			}
		}

		const secret = generateWebhookSecret();

		const endpointId = await ctx.db.insert("webhookEndpoints", {
			merchantId: args.merchantId,
			partnerId: args.partnerId,
			url: args.url,
			secret,
			events: args.events,
			status: "active",
			failureCount: 0,
			description: args.description,
		});

		const endpoint = await ctx.db.get(endpointId);
		return endpoint!;
	},
});

// ─── List Endpoints (Query) ─────────────────────────────────────────

/**
 * List webhook endpoints for a merchant or partner.
 */
export const listEndpoints = query({
	args: {
		merchantId: v.optional(v.id("merchants")),
		partnerId: v.optional(v.id("partners")),
	},
	returns: v.array(webhookEndpointValidator),
	handler: async (ctx, args) => {
		if (args.merchantId) {
			await withMerchant(ctx, args.merchantId);
			return await ctx.db
				.query("webhookEndpoints")
				.withIndex("by_merchantId", (q) =>
					q.eq("merchantId", args.merchantId),
				)
				.collect();
		}

		if (args.partnerId) {
			await withPartner(ctx, args.partnerId);
			return await ctx.db
				.query("webhookEndpoints")
				.withIndex("by_partnerId", (q) =>
					q.eq("partnerId", args.partnerId),
				)
				.collect();
		}

		validationError("Either merchantId or partnerId must be provided");
	},
});

// ─── Delete Endpoint (Mutation) ─────────────────────────────────────

/**
 * Delete a webhook endpoint.
 */
export const deleteEndpoint = mutation({
	args: {
		endpointId: v.id("webhookEndpoints"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await withAuth(ctx);

		const endpoint = await ctx.db.get(args.endpointId);
		if (!endpoint) {
			notFound("Webhook endpoint");
		}

		// Verify access
		if (endpoint.merchantId) {
			await withMerchant(ctx, endpoint.merchantId);
		} else if (endpoint.partnerId) {
			await withPartner(ctx, endpoint.partnerId);
		}

		await ctx.db.delete(args.endpointId);
		return null;
	},
});

// ─── Dispatch (Internal Mutation) ───────────────────────────────────

/**
 * Dispatch a webhook event.
 * Finds matching endpoints and creates webhookDeliveries with status "pending".
 */
export const dispatch = internalMutation({
	args: {
		event: v.string(),
		payload: v.any(),
		merchantId: v.id("merchants"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		// Find all active endpoints for this merchant that subscribe to this event
		const endpoints = await ctx.db
			.query("webhookEndpoints")
			.withIndex("by_merchantId", (q) =>
				q.eq("merchantId", args.merchantId),
			)
			.collect();

		let dispatched = 0;

		for (const endpoint of endpoints) {
			if (endpoint.status !== "active") continue;
			if (!endpoint.events.includes(args.event)) continue;

			const payloadString = JSON.stringify({
				event: args.event,
				data: args.payload,
				timestamp: Date.now(),
				merchantId: args.merchantId,
			});

			await ctx.db.insert("webhookDeliveries", {
				endpointId: endpoint._id,
				event: args.event,
				payload: payloadString,
				status: "pending",
				attempts: 0,
			});

			dispatched++;
		}

		return dispatched;
	},
});

// ─── Deliver Webhook (Internal Action) ──────────────────────────────

/**
 * Deliver a single webhook.
 * Fetch the URL with HMAC-signed payload.
 * Update delivery status via runMutation.
 */
export const deliverWebhook = internalAction({
	args: {
		deliveryId: v.id("webhookDeliveries"),
		endpointId: v.id("webhookEndpoints"),
		url: v.string(),
		secret: v.string(),
		payload: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const signaturePayload = `${timestamp}.${args.payload}`;
		const signature = await hmacSign(args.secret, signaturePayload);

		let statusCode: number | undefined;
		let responseBody: string | undefined;
		let success = false;

		try {
			const response = await fetch(args.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Logif-Signature": signature,
					"X-Logif-Timestamp": timestamp,
					"User-Agent": "Logif-Webhooks/1.0",
				},
				body: args.payload,
				signal: AbortSignal.timeout(10000), // 10 second timeout
			});

			statusCode = response.status;
			responseBody = await response.text().catch(() => undefined);

			// Consider 2xx as success
			success = response.status >= 200 && response.status < 300;
		} catch (error) {
			responseBody =
				error instanceof Error ? error.message : "Unknown error";
		}

		await ctx.runMutation(internal.webhooks.updateDeliveryStatus, {
			deliveryId: args.deliveryId,
			endpointId: args.endpointId,
			success,
			statusCode,
			responseBody: responseBody?.substring(0, 1000),
		});

		return null;
	},
});

// ─── Update Delivery Status (Internal Mutation) ─────────────────────

/**
 * Update the delivery status after an attempt.
 * On failure, set nextRetryAt with exponential backoff.
 * On success, reset endpoint failure count.
 */
export const updateDeliveryStatus = internalMutation({
	args: {
		deliveryId: v.id("webhookDeliveries"),
		endpointId: v.id("webhookEndpoints"),
		success: v.boolean(),
		statusCode: v.optional(v.number()),
		responseBody: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);
		if (!delivery) return null;

		const endpoint = await ctx.db.get(args.endpointId);
		if (!endpoint) return null;

		if (args.success) {
			await ctx.db.patch(args.deliveryId, {
				status: "delivered",
				statusCode: args.statusCode,
				responseBody: args.responseBody,
				lastAttemptAt: Date.now(),
			});

			// Reset failure count on success and update lastDeliveredAt
			await ctx.db.patch(args.endpointId, {
				failureCount: 0,
				lastDeliveredAt: Date.now(),
			});
		} else {
			const newAttempts = delivery.attempts + 1;

			if (newAttempts >= WEBHOOK_MAX_RETRIES) {
				// Mark as permanently failed
				await ctx.db.patch(args.deliveryId, {
					status: "failed",
					statusCode: args.statusCode,
					responseBody: args.responseBody,
					attempts: newAttempts,
					lastAttemptAt: Date.now(),
				});
			} else {
				// Schedule retry with exponential backoff: 1min, 4min, 9min, 16min, ...
				const backoffMs = Math.pow(newAttempts, 2) * 60 * 1000;
				const nextRetryAt = Date.now() + backoffMs;

				await ctx.db.patch(args.deliveryId, {
					status: "failed",
					statusCode: args.statusCode,
					responseBody: args.responseBody,
					attempts: newAttempts,
					lastAttemptAt: Date.now(),
					nextRetryAt,
				});
			}

			// Increment endpoint failure count
			const newFailureCount = endpoint.failureCount + 1;
			const updates: Record<string, unknown> = {
				failureCount: newFailureCount,
			};

			// Auto-disable endpoint after threshold failures
			if (newFailureCount >= WEBHOOK_AUTO_DISABLE_THRESHOLD) {
				updates.status = "disabled";
			}

			await ctx.db.patch(args.endpointId, updates);
		}

		return null;
	},
});

// ─── Retry Failed (Internal Mutation) ───────────────────────────────

/**
 * Find failed deliveries with nextRetryAt <= now, schedule deliverWebhook for each.
 * Called by cron every 5 minutes.
 */
export const retryFailed = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now();

		// Query failed deliveries that are due for retry
		const failedDeliveries = await ctx.db
			.query("webhookDeliveries")
			.withIndex("by_status_and_nextRetryAt", (q) =>
				q.eq("status", "failed").lte("nextRetryAt", now),
			)
			.take(50);

		let retried = 0;

		for (const delivery of failedDeliveries) {
			if (delivery.attempts >= WEBHOOK_MAX_RETRIES) {
				// Clear nextRetryAt so it doesn't keep appearing
				await ctx.db.patch(delivery._id, { nextRetryAt: undefined });
				continue;
			}

			const endpoint = await ctx.db.get(delivery.endpointId);
			if (!endpoint || endpoint.status !== "active") {
				// Endpoint is disabled or deleted, clear retry
				await ctx.db.patch(delivery._id, { nextRetryAt: undefined });
				continue;
			}

			// Reset status to pending while we re-attempt
			await ctx.db.patch(delivery._id, {
				status: "pending",
				nextRetryAt: undefined,
			});

			await ctx.scheduler.runAfter(
				0,
				internal.webhooks.deliverWebhook,
				{
					deliveryId: delivery._id,
					endpointId: endpoint._id,
					url: endpoint.url,
					secret: endpoint.secret,
					payload: delivery.payload,
				},
			);

			retried++;
		}

		return retried;
	},
});
