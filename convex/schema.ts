import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	// ─── Users ──────────────────────────────────────────────────────
	users: defineTable({
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
	})
		.index("by_tokenIdentifier", ["tokenIdentifier"])
		.index("by_email", ["email"])
		.index("by_role", ["role"]),

	// ─── Partners ──────────────────────────────────────────────────
	partners: defineTable({
		name: v.string(),
		slug: v.string(),
		ownerUserId: v.id("users"),
		status: v.union(
			v.literal("active"),
			v.literal("suspended"),
			v.literal("pending"),
		),
		contactEmail: v.string(),
		website: v.optional(v.string()),
		description: v.optional(v.string()),
		logoStorageId: v.optional(v.id("_storage")),
		subscriptionTierId: v.optional(v.id("subscriptionTiers")),
	})
		.index("by_slug", ["slug"])
		.index("by_ownerUserId", ["ownerUserId"])
		.index("by_status", ["status"]),

	partnerMembers: defineTable({
		partnerId: v.id("partners"),
		userId: v.id("users"),
		role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
	})
		.index("by_partnerId", ["partnerId"])
		.index("by_userId", ["userId"])
		.index("by_partnerId_and_userId", ["partnerId", "userId"]),

	// ─── Merchants ─────────────────────────────────────────────────
	merchants: defineTable({
		name: v.string(),
		slug: v.string(),
		ownerUserId: v.id("users"),
		partnerId: v.optional(v.id("partners")),
		status: v.union(
			v.literal("active"),
			v.literal("suspended"),
			v.literal("pending"),
		),
		contactEmail: v.string(),
		phone: v.optional(v.string()),
		address: v.optional(
			v.object({
				street: v.string(),
				city: v.string(),
				state: v.string(),
				zip: v.string(),
				country: v.string(),
			}),
		),
		website: v.optional(v.string()),
		description: v.optional(v.string()),
		logoStorageId: v.optional(v.id("_storage")),
		theme: v.optional(
			v.object({
				primary: v.optional(v.string()),
				primaryForeground: v.optional(v.string()),
				secondary: v.optional(v.string()),
				secondaryForeground: v.optional(v.string()),
				accent: v.optional(v.string()),
				accentForeground: v.optional(v.string()),
				background: v.optional(v.string()),
				foreground: v.optional(v.string()),
				card: v.optional(v.string()),
				cardForeground: v.optional(v.string()),
				muted: v.optional(v.string()),
				mutedForeground: v.optional(v.string()),
				destructive: v.optional(v.string()),
				border: v.optional(v.string()),
				input: v.optional(v.string()),
				ring: v.optional(v.string()),
				radius: v.optional(v.string()),
			}),
		),
		settings: v.optional(
			v.object({
				defaultCardExpDays: v.optional(v.number()),
				maxCardBalance: v.optional(v.number()),
				minLoadAmount: v.optional(v.number()),
				maxLoadAmount: v.optional(v.number()),
				allowPartialRedeem: v.optional(v.boolean()),
				requirePin: v.optional(v.boolean()),
				currency: v.optional(v.string()),
			}),
		),
		subscriptionTierId: v.optional(v.id("subscriptionTiers")),
		transactionFeePercent: v.optional(v.number()),
		transactionFeeFlat: v.optional(v.number()),
	})
		.index("by_slug", ["slug"])
		.index("by_ownerUserId", ["ownerUserId"])
		.index("by_partnerId", ["partnerId"])
		.index("by_status", ["status"]),

	merchantMembers: defineTable({
		merchantId: v.id("merchants"),
		userId: v.id("users"),
		role: v.union(
			v.literal("owner"),
			v.literal("admin"),
			v.literal("staff"),
		),
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_userId", ["userId"])
		.index("by_merchantId_and_userId", ["merchantId", "userId"]),

	// ─── Customers ─────────────────────────────────────────────────
	customers: defineTable({
		merchantId: v.id("merchants"),
		userId: v.optional(v.id("users")),
		email: v.string(),
		name: v.optional(v.string()),
		phone: v.optional(v.string()),
		loyaltyPoints: v.number(),
		totalSpent: v.number(),
		totalLoaded: v.number(),
		cardCount: v.number(),
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_userId", ["userId"])
		.index("by_merchantId_and_email", ["merchantId", "email"]),

	// ─── Gift Cards ────────────────────────────────────────────────
	cards: defineTable({
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
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_cardNumber", ["cardNumber"])
		.index("by_codeHash", ["codeHash"])
		.index("by_trackDataHash", ["trackDataHash"])
		.index("by_customerId", ["customerId"])
		.index("by_merchantId_and_status", ["merchantId", "status"])
		.searchIndex("search_cardNumber", {
			searchField: "cardNumber",
			filterFields: ["merchantId"],
		}),

	// ─── Transactions ──────────────────────────────────────────────
	transactions: defineTable({
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
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_cardId", ["cardId"])
		.index("by_customerId", ["customerId"])
		.index("by_merchantId_and_type", ["merchantId", "type"]),

	// ─── API Keys ──────────────────────────────────────────────────
	apiKeys: defineTable({
		name: v.string(),
		keyPrefix: v.string(),
		keyHash: v.string(),
		partnerId: v.optional(v.id("partners")),
		merchantId: v.optional(v.id("merchants")),
		createdByUserId: v.id("users"),
		permissions: v.array(v.string()),
		environment: v.union(v.literal("live"), v.literal("test")),
		status: v.union(
			v.literal("active"),
			v.literal("revoked"),
		),
		lastUsedAt: v.optional(v.number()),
		expiresAt: v.optional(v.number()),
		rateLimitPerMinute: v.number(),
		rateLimitPerDay: v.number(),
		allowedMerchantIds: v.optional(v.array(v.id("merchants"))),
	})
		.index("by_keyHash", ["keyHash"])
		.index("by_partnerId", ["partnerId"])
		.index("by_merchantId", ["merchantId"]),

	apiKeyRateLimits: defineTable({
		apiKeyId: v.id("apiKeys"),
		windowType: v.union(v.literal("minute"), v.literal("day")),
		windowStart: v.number(),
		count: v.number(),
	}).index("by_apiKeyId_and_windowType_and_windowStart", [
		"apiKeyId",
		"windowType",
		"windowStart",
	]),

	apiRequestLogs: defineTable({
		apiKeyId: v.id("apiKeys"),
		merchantId: v.optional(v.id("merchants")),
		method: v.string(),
		path: v.string(),
		statusCode: v.number(),
		durationMs: v.number(),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
	})
		.index("by_apiKeyId", ["apiKeyId"])
		.index("by_merchantId", ["merchantId"]),

	// ─── Import Batches ────────────────────────────────────────────
	importBatches: defineTable({
		merchantId: v.id("merchants"),
		fileName: v.string(),
		fileStorageId: v.optional(v.id("_storage")),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("failed"),
		),
		totalRows: v.number(),
		processedRows: v.number(),
		successCount: v.number(),
		errorCount: v.number(),
		errors: v.optional(v.array(v.object({
			row: v.number(),
			message: v.string(),
		}))),
		createdByUserId: v.id("users"),
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_merchantId_and_status", ["merchantId", "status"]),

	// ─── Billing ───────────────────────────────────────────────────
	subscriptionTiers: defineTable({
		name: v.string(),
		slug: v.string(),
		targetEntity: v.union(v.literal("merchant"), v.literal("partner")),
		isActive: v.boolean(),
		monthlyPrice: v.number(),
		annualPrice: v.optional(v.number()),
		transactionFeePercent: v.number(),
		transactionFeeFlat: v.number(),
		features: v.object({
			maxCards: v.number(),
			maxApiRequests: v.number(),
			customBranding: v.boolean(),
			webhooks: v.boolean(),
			bulkOperations: v.boolean(),
			apiAccess: v.boolean(),
			emailTemplates: v.boolean(),
			multipleUsers: v.boolean(),
			maxUsers: v.number(),
		}),
		description: v.optional(v.string()),
		sortOrder: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_targetEntity_and_isActive", ["targetEntity", "isActive"]),

	invoices: defineTable({
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
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_partnerId", ["partnerId"])
		.index("by_status", ["status"]),

	invoiceLineItems: defineTable({
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
	}).index("by_invoiceId", ["invoiceId"]),

	// ─── Webhooks ──────────────────────────────────────────────────
	webhookEndpoints: defineTable({
		merchantId: v.optional(v.id("merchants")),
		partnerId: v.optional(v.id("partners")),
		url: v.string(),
		secret: v.string(),
		events: v.array(v.string()),
		status: v.union(
			v.literal("active"),
			v.literal("disabled"),
		),
		failureCount: v.number(),
		lastDeliveredAt: v.optional(v.number()),
		description: v.optional(v.string()),
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_partnerId", ["partnerId"]),

	webhookDeliveries: defineTable({
		endpointId: v.id("webhookEndpoints"),
		event: v.string(),
		payload: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("delivered"),
			v.literal("failed"),
		),
		statusCode: v.optional(v.number()),
		responseBody: v.optional(v.string()),
		attempts: v.number(),
		nextRetryAt: v.optional(v.number()),
		lastAttemptAt: v.optional(v.number()),
	})
		.index("by_endpointId", ["endpointId"])
		.index("by_status_and_nextRetryAt", ["status", "nextRetryAt"]),

	// ─── Audit Logs ────────────────────────────────────────────────
	auditLogs: defineTable({
		merchantId: v.optional(v.id("merchants")),
		userId: v.optional(v.id("users")),
		apiKeyId: v.optional(v.id("apiKeys")),
		action: v.string(),
		entityType: v.string(),
		entityId: v.string(),
		changes: v.optional(v.any()),
		ipAddress: v.optional(v.string()),
		userAgent: v.optional(v.string()),
	})
		.index("by_merchantId", ["merchantId"])
		.index("by_userId", ["userId"])
		.index("by_entityType_and_entityId", ["entityType", "entityId"]),

	// ─── Email ─────────────────────────────────────────────────────
	emailTemplates: defineTable({
		merchantId: v.id("merchants"),
		type: v.union(
			v.literal("gift_card_delivery"),
			v.literal("gift_card_reminder"),
			v.literal("balance_notification"),
			v.literal("welcome"),
		),
		subject: v.string(),
		htmlBody: v.string(),
		textBody: v.optional(v.string()),
		isActive: v.boolean(),
	}).index("by_merchantId_and_type", ["merchantId", "type"]),

	emailQueue: defineTable({
		merchantId: v.optional(v.id("merchants")),
		to: v.string(),
		from: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.string(),
		textBody: v.optional(v.string()),
		status: v.union(
			v.literal("pending"),
			v.literal("sent"),
			v.literal("failed"),
		),
		attempts: v.number(),
		lastAttemptAt: v.optional(v.number()),
		sentAt: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
		metadata: v.optional(v.any()),
	})
		.index("by_status", ["status"])
		.index("by_merchantId", ["merchantId"]),
});
