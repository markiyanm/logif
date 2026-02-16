import { v } from "convex/values";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "./constants.js";

export const paginationArgs = {
	cursor: v.optional(v.string()),
	limit: v.optional(v.number()),
};

export function getPaginationOpts(args: {
	cursor?: string;
	limit?: number;
}) {
	return {
		cursor: args.cursor ?? null,
		numItems: Math.min(
			args.limit ?? PAGINATION_DEFAULT_LIMIT,
			PAGINATION_MAX_LIMIT,
		),
	};
}

export const idArg = (table: string) => ({
	id: v.id(table as never),
});

export const merchantScopeArgs = {
	merchantId: v.id("merchants"),
};

export const partnerScopeArgs = {
	partnerId: v.id("partners"),
};

export const dateRangeArgs = {
	startDate: v.optional(v.number()),
	endDate: v.optional(v.number()),
};
