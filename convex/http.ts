import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { Id } from "./_generated/dataModel.js";
import { ConvexError } from "convex/values";
import { hasPermission } from "./lib/permissions.js";
import type { ApiPermission } from "./lib/constants.js";

// ─── Types ─────────────────────────────────────────────────────────

interface ApiKeyDoc {
	_id: Id<"apiKeys">;
	_creationTime: number;
	name: string;
	keyPrefix: string;
	keyHash: string;
	partnerId?: Id<"partners">;
	merchantId?: Id<"merchants">;
	createdByUserId: Id<"users">;
	permissions: string[];
	environment: "live" | "test";
	status: "active" | "revoked";
	lastUsedAt?: number;
	expiresAt?: number;
	rateLimitPerMinute: number;
	rateLimitPerDay: number;
	allowedMerchantIds?: Id<"merchants">[];
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: number;
}

// ─── Response Helpers ──────────────────────────────────────────────

function jsonResponse(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			...headers,
		},
	});
}

function successResponse(
	data: unknown,
	meta?: Record<string, unknown>,
	status = 200,
	rateLimitHeaders: Record<string, string> = {},
): Response {
	const body: Record<string, unknown> = { success: true, data };
	if (meta && Object.keys(meta).length > 0) {
		body.meta = meta;
	}
	return jsonResponse(body, status, rateLimitHeaders);
}

function errorResponse(
	code: string,
	message: string,
	status: number,
	rateLimitHeaders: Record<string, string> = {},
): Response {
	return jsonResponse(
		{
			success: false,
			error: { code, message },
		},
		status,
		rateLimitHeaders,
	);
}

/**
 * Map error codes to HTTP status codes.
 */
function errorCodeToStatus(code: string): number {
	switch (code) {
		case "UNAUTHORIZED":
		case "INVALID_API_KEY":
		case "API_KEY_REVOKED":
			return 401;
		case "FORBIDDEN":
		case "PERMISSION_DENIED":
			return 403;
		case "NOT_FOUND":
			return 404;
		case "CONFLICT":
			return 409;
		case "VALIDATION_ERROR":
		case "INVALID_AMOUNT":
			return 400;
		case "RATE_LIMITED":
			return 429;
		case "INSUFFICIENT_BALANCE":
			return 422;
		case "CARD_INACTIVE":
		case "CARD_EXPIRED":
			return 422;
		default:
			return 500;
	}
}

/**
 * Extract error code and message from a ConvexError or generic Error.
 */
function extractError(err: unknown): { code: string; message: string } {
	if (err instanceof ConvexError) {
		const data = err.data as { code?: string; message?: string };
		return {
			code: data.code ?? "INTERNAL_ERROR",
			message: data.message ?? "An unexpected error occurred",
		};
	}
	if (err instanceof Error) {
		return {
			code: "INTERNAL_ERROR",
			message: err.message,
		};
	}
	return {
		code: "INTERNAL_ERROR",
		message: "An unexpected error occurred",
	};
}

// ─── Route Matching ────────────────────────────────────────────────

/**
 * Check if a URL pathname matches a route pattern.
 * Returns extracted params or null if no match.
 */
function matchRoute(
	pathname: string,
	pattern: string,
): Record<string, string> | null {
	const pathParts = pathname.split("/").filter(Boolean);
	const patternParts = pattern.split("/").filter(Boolean);

	if (pathParts.length !== patternParts.length) {
		return null;
	}

	const params: Record<string, string> = {};
	for (let i = 0; i < patternParts.length; i++) {
		if (patternParts[i].startsWith(":")) {
			const paramName = patternParts[i].substring(1);
			params[paramName] = pathParts[i];
		} else if (patternParts[i] !== pathParts[i]) {
			return null;
		}
	}

	return params;
}

// ─── Query String Parsing ──────────────────────────────────────────

function parseQueryParams(url: URL): Record<string, string> {
	const params: Record<string, string> = {};
	url.searchParams.forEach((value, key) => {
		params[key] = value;
	});
	return params;
}

// ─── Route Handler Type ────────────────────────────────────────────

type ActionCtx = {
	runQuery: (ref: any, args: any) => Promise<any>;
	runMutation: (ref: any, args: any) => Promise<any>;
	runAction: (ref: any, args: any) => Promise<any>;
};

type RouteHandler = (ctx: ActionCtx, opts: {
	apiKey: ApiKeyDoc;
	params: Record<string, string>;
	query: Record<string, string>;
	body: any;
	request: Request;
}) => Promise<{ data: any; meta?: Record<string, unknown>; status?: number }>;

// ─── Route Definitions ─────────────────────────────────────────────

interface RouteDefinition {
	pattern: string;
	method: string;
	permission: ApiPermission | null; // null = no auth required
	handler: RouteHandler;
}

/**
 * Resolve the merchantId for an API request.
 * API keys scoped to a single merchant use that merchant.
 * Partner API keys accept a merchantId in the query/body and
 * verify it is in their allowedMerchantIds.
 */
function resolveMerchantId(
	apiKey: ApiKeyDoc,
	requestMerchantId?: string,
): Id<"merchants"> {
	if (apiKey.merchantId) {
		return apiKey.merchantId;
	}

	// Partner key -- must provide merchantId in request
	if (!requestMerchantId) {
		throw new ConvexError({
			code: "VALIDATION_ERROR",
			message:
				"merchantId is required for partner-scoped API keys",
		});
	}

	const mid = requestMerchantId as Id<"merchants">;

	// If allowedMerchantIds is set, verify access
	if (
		apiKey.allowedMerchantIds &&
		apiKey.allowedMerchantIds.length > 0
	) {
		if (!apiKey.allowedMerchantIds.includes(mid)) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message:
					"API key does not have access to this merchant",
			});
		}
	}

	return mid;
}

// ─── Card Routes ───────────────────────────────────────────────────

const createCard: RouteHandler = async (ctx, { apiKey, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const card = await ctx.runMutation(internal.cards.apiCreateSingle, {
		merchantId,
		type: body.type ?? "digital",
		initialBalance: body.initialBalance ?? body.initial_balance ?? 0,
		currency: body.currency,
		customerId: body.customerId ?? body.customer_id,
		expiresAt: body.expiresAt ?? body.expires_at,
		pin: body.pin,
		trackData: body.trackData ?? body.track_data,
	});

	return { data: card, status: 201 };
};

const listCards: RouteHandler = async (ctx, { apiKey, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, qs.merchantId);
	const cursor = qs.cursor || null;
	const numItems = Math.min(parseInt(qs.limit || "25", 10), 100);

	const result = await ctx.runQuery(internal.cards.apiListByMerchant, {
		merchantId,
		status: qs.status || undefined,
		paginationOpts: { cursor, numItems },
	});

	return {
		data: result.page,
		meta: {
			cursor: result.continueCursor,
			hasMore: !result.isDone,
		},
	};
};

const getCard: RouteHandler = async (ctx, { apiKey, params }) => {
	const merchantId = apiKey.merchantId;
	const card = await ctx.runQuery(internal.cards.apiGetById, {
		cardId: params.cardId as Id<"cards">,
		merchantId,
	});

	if (!card) {
		throw new ConvexError({ code: "NOT_FOUND", message: "Card not found" });
	}

	return { data: card };
};

const updateCardStatus: RouteHandler = async (ctx, { apiKey, params, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const card = await ctx.runMutation(internal.cards.apiUpdateStatus, {
		merchantId,
		cardId: params.cardId as Id<"cards">,
		status: body.status,
	});

	return { data: card };
};

const loadCard: RouteHandler = async (ctx, { apiKey, params, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const transaction = await ctx.runMutation(internal.transactions.apiLoad, {
		merchantId,
		cardId: params.cardId as Id<"cards">,
		amount: body.amount,
		description: body.description,
		reference: body.reference,
		apiKeyId: apiKey._id,
	});

	return { data: transaction };
};

const redeemCard: RouteHandler = async (ctx, { apiKey, params, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const transaction = await ctx.runMutation(internal.transactions.apiRedeem, {
		merchantId,
		cardId: params.cardId as Id<"cards">,
		amount: body.amount,
		description: body.description,
		reference: body.reference,
		apiKeyId: apiKey._id,
	});

	return { data: transaction };
};

const redeemByCode: RouteHandler = async (ctx, { apiKey, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const transaction = await ctx.runMutation(
		internal.transactions.apiRedeemByCode,
		{
			merchantId,
			code: body.code,
			amount: body.amount,
			description: body.description,
			reference: body.reference,
			apiKeyId: apiKey._id,
		},
	);

	return { data: transaction };
};

const redeemByTrack: RouteHandler = async (ctx, { apiKey, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const transaction = await ctx.runMutation(
		internal.transactions.apiRedeemByTrackData,
		{
			merchantId,
			trackData: body.trackData ?? body.track_data,
			amount: body.amount,
			description: body.description,
			reference: body.reference,
			apiKeyId: apiKey._id,
		},
	);

	return { data: transaction };
};

const transferCard: RouteHandler = async (ctx, { apiKey, params, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const result = await ctx.runMutation(internal.transactions.apiTransfer, {
		merchantId,
		fromCardId: params.cardId as Id<"cards">,
		toCardId: (body.toCardId ?? body.to_card_id) as Id<"cards">,
		amount: body.amount,
		description: body.description,
		reference: body.reference,
		apiKeyId: apiKey._id,
	});

	return { data: result };
};

const checkBalance: RouteHandler = async (ctx, { body }) => {
	const cardNumber = body.cardNumber ?? body.card_number;

	if (!cardNumber) {
		throw new ConvexError({
			code: "VALIDATION_ERROR",
			message: "cardNumber is required",
		});
	}

	const result = await ctx.runQuery(internal.cards.apiCheckBalance, {
		cardNumber,
	});

	if (!result) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Card not found",
		});
	}

	return { data: result };
};

// ─── Transaction Routes ────────────────────────────────────────────

const listTransactions: RouteHandler = async (ctx, { apiKey, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, qs.merchantId);
	const cursor = qs.cursor || null;
	const numItems = Math.min(parseInt(qs.limit || "25", 10), 100);

	const result = await ctx.runQuery(
		internal.transactions.apiListByMerchant,
		{
			merchantId,
			type: qs.type || undefined,
			paginationOpts: { cursor, numItems },
		},
	);

	return {
		data: result.page,
		meta: {
			cursor: result.continueCursor,
			hasMore: !result.isDone,
		},
	};
};

const getTransaction: RouteHandler = async (ctx, { apiKey, params }) => {
	const merchantId = apiKey.merchantId;
	const txn = await ctx.runQuery(internal.transactions.apiGetById, {
		transactionId: params.txnId as Id<"transactions">,
		merchantId,
	});

	if (!txn) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Transaction not found",
		});
	}

	return { data: txn };
};

// ─── Customer Routes ───────────────────────────────────────────────

const createCustomer: RouteHandler = async (ctx, { apiKey, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	const customerId = await ctx.runMutation(internal.customers.apiCreate, {
		merchantId,
		email: body.email,
		name: body.name,
		phone: body.phone,
	});

	// Fetch the created customer to return full data
	const customer = await ctx.runQuery(internal.customers.apiGetById, {
		customerId,
		merchantId,
	});

	return { data: customer, status: 201 };
};

const listCustomers: RouteHandler = async (ctx, { apiKey, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, qs.merchantId);

	const result = await ctx.runQuery(
		internal.customers.apiListByMerchant,
		{
			merchantId,
			cursor: qs.cursor,
			limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
		},
	);

	return {
		data: result.page,
		meta: {
			cursor: result.continueCursor,
			hasMore: !result.isDone,
		},
	};
};

const getCustomer: RouteHandler = async (ctx, { apiKey, params }) => {
	const merchantId = apiKey.merchantId;
	const customer = await ctx.runQuery(internal.customers.apiGetById, {
		customerId: params.id as Id<"customers">,
		merchantId,
	});

	if (!customer) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Customer not found",
		});
	}

	return { data: customer };
};

const updateCustomer: RouteHandler = async (ctx, { apiKey, params, body, query: qs }) => {
	const merchantId = resolveMerchantId(apiKey, body.merchantId ?? qs.merchantId);

	await ctx.runMutation(internal.customers.apiUpdate, {
		customerId: params.id as Id<"customers">,
		merchantId,
		name: body.name,
		phone: body.phone,
		email: body.email,
	});

	// Fetch updated customer
	const customer = await ctx.runQuery(internal.customers.apiGetById, {
		customerId: params.id as Id<"customers">,
		merchantId,
	});

	return { data: customer };
};

// ─── Route Table ───────────────────────────────────────────────────

const routes: RouteDefinition[] = [
	// Cards -- static paths first, then parameterized
	{
		pattern: "/api/v1/cards/check-balance",
		method: "POST",
		permission: null,
		handler: checkBalance,
	},
	{
		pattern: "/api/v1/cards/redeem-by-code",
		method: "POST",
		permission: "cards:redeem",
		handler: redeemByCode,
	},
	{
		pattern: "/api/v1/cards/redeem-by-track",
		method: "POST",
		permission: "cards:redeem",
		handler: redeemByTrack,
	},
	{
		pattern: "/api/v1/cards",
		method: "POST",
		permission: "cards:create",
		handler: createCard,
	},
	{
		pattern: "/api/v1/cards",
		method: "GET",
		permission: "cards:read",
		handler: listCards,
	},
	{
		pattern: "/api/v1/cards/:cardId/load",
		method: "POST",
		permission: "cards:load",
		handler: loadCard,
	},
	{
		pattern: "/api/v1/cards/:cardId/redeem",
		method: "POST",
		permission: "cards:redeem",
		handler: redeemCard,
	},
	{
		pattern: "/api/v1/cards/:cardId/transfer",
		method: "POST",
		permission: "cards:transfer",
		handler: transferCard,
	},
	{
		pattern: "/api/v1/cards/:cardId",
		method: "GET",
		permission: "cards:read",
		handler: getCard,
	},
	{
		pattern: "/api/v1/cards/:cardId",
		method: "PATCH",
		permission: "cards:update",
		handler: updateCardStatus,
	},
	// Transactions
	{
		pattern: "/api/v1/transactions",
		method: "GET",
		permission: "transactions:read",
		handler: listTransactions,
	},
	{
		pattern: "/api/v1/transactions/:txnId",
		method: "GET",
		permission: "transactions:read",
		handler: getTransaction,
	},
	// Customers
	{
		pattern: "/api/v1/customers",
		method: "POST",
		permission: "customers:create",
		handler: createCustomer,
	},
	{
		pattern: "/api/v1/customers",
		method: "GET",
		permission: "customers:read",
		handler: listCustomers,
	},
	{
		pattern: "/api/v1/customers/:id",
		method: "GET",
		permission: "customers:read",
		handler: getCustomer,
	},
	{
		pattern: "/api/v1/customers/:id",
		method: "PATCH",
		permission: "customers:update",
		handler: updateCustomer,
	},
];

// ─── Unified Route Dispatcher ──────────────────────────────────────

/**
 * Dispatches an incoming request to the matching route definition.
 * Handles authentication, rate limiting, permission checking, and request logging.
 */
const dispatchRoute = httpAction(async (ctx, request) => {
	const startTime = Date.now();
	const url = new URL(request.url);
	const method = request.method;
	const pathname = url.pathname;
	const queryParams = parseQueryParams(url);

	// Handle CORS preflight
	if (method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods":
					"GET, POST, PATCH, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers":
					"Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	// Find matching route
	let matchedRoute: RouteDefinition | null = null;
	let params: Record<string, string> = {};

	for (const route of routes) {
		if (route.method !== method) {
			continue;
		}
		const m = matchRoute(pathname, route.pattern);
		if (m !== null) {
			matchedRoute = route;
			params = m;
			break;
		}
	}

	if (!matchedRoute) {
		return errorResponse("NOT_FOUND", "Endpoint not found", 404);
	}

	// Parse request body for POST/PATCH/PUT
	let body: any = {};
	if (method === "POST" || method === "PATCH" || method === "PUT") {
		try {
			const text = await request.text();
			if (text) {
				body = JSON.parse(text);
			}
		} catch {
			return errorResponse(
				"VALIDATION_ERROR",
				"Invalid JSON in request body",
				400,
			);
		}
	}

	// Public endpoints (no auth required)
	if (matchedRoute.permission === null) {
		try {
			const result = await matchedRoute.handler(ctx, {
				apiKey: {} as ApiKeyDoc,
				params,
				query: queryParams,
				body,
				request,
			});

			return successResponse(
				result.data,
				result.meta,
				result.status ?? 200,
			);
		} catch (err) {
			const { code, message } = extractError(err);
			return errorResponse(code, message, errorCodeToStatus(code));
		}
	}

	// ─── Authenticated endpoints ───────────────────────────────

	// 1. Extract API key from Authorization header
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return errorResponse(
			"UNAUTHORIZED",
			"Missing or invalid Authorization header. Expected: Bearer lgf_...",
			401,
		);
	}

	const keyString = authHeader.substring(7); // Remove "Bearer "
	if (!keyString.startsWith("lgf_")) {
		return errorResponse(
			"UNAUTHORIZED",
			"Invalid API key format",
			401,
		);
	}

	// 2. Validate the API key
	let apiKey: ApiKeyDoc;
	try {
		apiKey = await ctx.runMutation(internal.apiKeys.validateKey, {
			key: keyString,
		}) as ApiKeyDoc;
	} catch (err) {
		const { code, message } = extractError(err);
		return errorResponse(code, message, errorCodeToStatus(code));
	}

	// 3. Check rate limit (per-minute)
	let rateLimitResult: RateLimitResult;
	try {
		rateLimitResult = await ctx.runMutation(
			internal.apiKeys.checkRateLimit,
			{
				apiKeyId: apiKey._id,
				windowType: "minute" as const,
			},
		) as RateLimitResult;
	} catch (err) {
		const { code, message } = extractError(err);
		return errorResponse(code, message, 500);
	}

	const rateLimitHeaders: Record<string, string> = {
		"X-RateLimit-Limit": String(rateLimitResult.limit),
		"X-RateLimit-Remaining": String(rateLimitResult.remaining),
		"X-RateLimit-Reset": String(
			Math.ceil(rateLimitResult.resetAt / 1000),
		),
	};

	if (!rateLimitResult.allowed) {
		const durationMs = Date.now() - startTime;
		// Log the rate-limited request
		await ctx.runMutation(internal.apiKeys.logRequest, {
			apiKeyId: apiKey._id,
			merchantId: apiKey.merchantId,
			method,
			path: pathname,
			statusCode: 429,
			durationMs,
			ipAddress: request.headers.get("X-Forwarded-For") ?? undefined,
			userAgent: request.headers.get("User-Agent") ?? undefined,
			errorMessage: "Rate limit exceeded",
		});

		return errorResponse(
			"RATE_LIMITED",
			"Rate limit exceeded. Try again later.",
			429,
			rateLimitHeaders,
		);
	}

	// Also check daily rate limit
	try {
		const dailyResult = await ctx.runMutation(
			internal.apiKeys.checkRateLimit,
			{
				apiKeyId: apiKey._id,
				windowType: "day" as const,
			},
		) as RateLimitResult;

		if (!dailyResult.allowed) {
			const durationMs = Date.now() - startTime;
			await ctx.runMutation(internal.apiKeys.logRequest, {
				apiKeyId: apiKey._id,
				merchantId: apiKey.merchantId,
				method,
				path: pathname,
				statusCode: 429,
				durationMs,
				ipAddress:
					request.headers.get("X-Forwarded-For") ?? undefined,
				userAgent:
					request.headers.get("User-Agent") ?? undefined,
				errorMessage: "Daily rate limit exceeded",
			});

			return errorResponse(
				"RATE_LIMITED",
				"Daily rate limit exceeded. Try again tomorrow.",
				429,
				{
					"X-RateLimit-Limit": String(dailyResult.limit),
					"X-RateLimit-Remaining": String(dailyResult.remaining),
					"X-RateLimit-Reset": String(
						Math.ceil(dailyResult.resetAt / 1000),
					),
				},
			);
		}
	} catch {
		// Non-fatal: proceed if daily check fails
	}

	// 4. Check required permission
	if (
		matchedRoute.permission &&
		!hasPermission(apiKey.permissions, matchedRoute.permission)
	) {
		const durationMs = Date.now() - startTime;
		await ctx.runMutation(internal.apiKeys.logRequest, {
			apiKeyId: apiKey._id,
			merchantId: apiKey.merchantId,
			method,
			path: pathname,
			statusCode: 403,
			durationMs,
			ipAddress: request.headers.get("X-Forwarded-For") ?? undefined,
			userAgent: request.headers.get("User-Agent") ?? undefined,
			errorMessage: `Missing permission: ${matchedRoute.permission}`,
		});

		return errorResponse(
			"PERMISSION_DENIED",
			`API key missing required permission: ${matchedRoute.permission}`,
			403,
			rateLimitHeaders,
		);
	}

	// 5. Execute the route handler
	try {
		const result = await matchedRoute.handler(ctx, {
			apiKey,
			params,
			query: queryParams,
			body,
			request,
		});

		const statusCode = result.status ?? 200;
		const durationMs = Date.now() - startTime;

		// 6. Log the successful request
		await ctx.runMutation(internal.apiKeys.logRequest, {
			apiKeyId: apiKey._id,
			merchantId: apiKey.merchantId,
			method,
			path: pathname,
			statusCode,
			durationMs,
			ipAddress: request.headers.get("X-Forwarded-For") ?? undefined,
			userAgent: request.headers.get("User-Agent") ?? undefined,
		});

		return successResponse(
			result.data,
			result.meta,
			statusCode,
			rateLimitHeaders,
		);
	} catch (err) {
		const { code, message } = extractError(err);
		const statusCode = errorCodeToStatus(code);
		const durationMs = Date.now() - startTime;

		// Log the failed request
		await ctx.runMutation(internal.apiKeys.logRequest, {
			apiKeyId: apiKey._id,
			merchantId: apiKey.merchantId,
			method,
			path: pathname,
			statusCode,
			durationMs,
			ipAddress: request.headers.get("X-Forwarded-For") ?? undefined,
			userAgent: request.headers.get("User-Agent") ?? undefined,
			errorMessage: message,
		});

		return errorResponse(code, message, statusCode, rateLimitHeaders);
	}
});

// ─── HTTP Router ───────────────────────────────────────────────────

const http = httpRouter();

// Register all /api/v1/* routes to the unified dispatcher.
// Convex httpRouter requires explicit method + path pairs.
// We register exact paths for collection endpoints, and pathPrefix
// for routes that require dynamic path parameters.

// Cards -- exact paths
http.route({
	path: "/api/v1/cards",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/cards",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/cards",
	method: "OPTIONS",
	handler: dispatchRoute,
});

http.route({
	path: "/api/v1/cards/check-balance",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/cards/check-balance",
	method: "OPTIONS",
	handler: dispatchRoute,
});

http.route({
	path: "/api/v1/cards/redeem-by-code",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/cards/redeem-by-code",
	method: "OPTIONS",
	handler: dispatchRoute,
});

http.route({
	path: "/api/v1/cards/redeem-by-track",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/cards/redeem-by-track",
	method: "OPTIONS",
	handler: dispatchRoute,
});

// Cards -- dynamic paths (pathPrefix catches /api/v1/cards/:cardId and sub-routes)
http.route({
	pathPrefix: "/api/v1/cards/",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/cards/",
	method: "PATCH",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/cards/",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/cards/",
	method: "OPTIONS",
	handler: dispatchRoute,
});

// Transactions -- exact paths
http.route({
	path: "/api/v1/transactions",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/transactions",
	method: "OPTIONS",
	handler: dispatchRoute,
});

// Transactions -- dynamic paths
http.route({
	pathPrefix: "/api/v1/transactions/",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/transactions/",
	method: "OPTIONS",
	handler: dispatchRoute,
});

// Customers -- exact paths
http.route({
	path: "/api/v1/customers",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/customers",
	method: "POST",
	handler: dispatchRoute,
});
http.route({
	path: "/api/v1/customers",
	method: "OPTIONS",
	handler: dispatchRoute,
});

// Customers -- dynamic paths
http.route({
	pathPrefix: "/api/v1/customers/",
	method: "GET",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/customers/",
	method: "PATCH",
	handler: dispatchRoute,
});
http.route({
	pathPrefix: "/api/v1/customers/",
	method: "OPTIONS",
	handler: dispatchRoute,
});

export default http;
