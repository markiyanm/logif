import { ConvexError } from "convex/values";

export type ErrorCode =
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "CONFLICT"
	| "RATE_LIMITED"
	| "INSUFFICIENT_BALANCE"
	| "CARD_INACTIVE"
	| "CARD_EXPIRED"
	| "INVALID_AMOUNT"
	| "INVALID_API_KEY"
	| "API_KEY_REVOKED"
	| "PERMISSION_DENIED"
	| "INTERNAL_ERROR";

export function throwError(
	code: ErrorCode,
	message: string,
): never {
	throw new ConvexError({ code, message });
}

export function unauthorized(message = "Authentication required"): never {
	throwError("UNAUTHORIZED", message);
}

export function forbidden(message = "You do not have permission to perform this action"): never {
	throwError("FORBIDDEN", message);
}

export function notFound(entity: string): never {
	throwError("NOT_FOUND", `${entity} not found`);
}

export function validationError(message: string): never {
	throwError("VALIDATION_ERROR", message);
}

export function conflict(message: string): never {
	throwError("CONFLICT", message);
}

export function rateLimited(message = "Rate limit exceeded"): never {
	throwError("RATE_LIMITED", message);
}

export function insufficientBalance(): never {
	throwError("INSUFFICIENT_BALANCE", "Insufficient card balance");
}

export function cardInactive(): never {
	throwError("CARD_INACTIVE", "Card is not active");
}

export function cardExpired(): never {
	throwError("CARD_EXPIRED", "Card has expired");
}

export function invalidAmount(message = "Invalid amount"): never {
	throwError("INVALID_AMOUNT", message);
}
