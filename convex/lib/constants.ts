export const CARD_NUMBER_PREFIX = "LOGIF";
export const CARD_NUMBER_SEGMENTS = 4;
export const CARD_NUMBER_SEGMENT_LENGTH = 4;

export const API_KEY_PREFIX_LIVE = "lgf_live_";
export const API_KEY_PREFIX_TEST = "lgf_test_";
export const API_KEY_RANDOM_LENGTH = 56;

export const DEFAULT_CURRENCY = "USD";
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const DEFAULT_RATE_LIMIT_PER_DAY = 10000;

export const DEFAULT_MAX_CARD_BALANCE = 100000; // $1,000.00 in cents
export const DEFAULT_MIN_LOAD_AMOUNT = 100; // $1.00
export const DEFAULT_MAX_LOAD_AMOUNT = 50000; // $500.00
export const DEFAULT_CARD_EXP_DAYS = 365;

export const WEBHOOK_MAX_RETRIES = 5;
export const WEBHOOK_AUTO_DISABLE_THRESHOLD = 10;

export const EMAIL_MAX_RETRIES = 3;

export const PAGINATION_DEFAULT_LIMIT = 25;
export const PAGINATION_MAX_LIMIT = 100;

export const API_PERMISSIONS = [
	"cards:create",
	"cards:read",
	"cards:update",
	"cards:redeem",
	"cards:load",
	"cards:transfer",
	"cards:bulk",
	"transactions:read",
	"customers:create",
	"customers:read",
	"customers:update",
	"merchants:read",
	"merchants:update",
	"webhooks:manage",
	"reports:read",
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

export const WEBHOOK_EVENTS = [
	"card.created",
	"card.activated",
	"card.suspended",
	"card.expired",
	"card.cancelled",
	"card.loaded",
	"card.redeemed",
	"card.transferred",
	"card.adjusted",
	"card.refunded",
	"transaction.completed",
	"customer.created",
	"customer.updated",
	"import.completed",
	"import.failed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
