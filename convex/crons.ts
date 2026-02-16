import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

// Process pending emails from the queue every 1 minute
crons.interval(
	"process email queue",
	{ minutes: 1 },
	internal.email.processEmailQueue,
);

// Retry failed webhook deliveries every 5 minutes
crons.interval(
	"retry failed webhooks",
	{ minutes: 5 },
	internal.webhooks.retryFailed,
);

// Expire cards past their expiresAt timestamp every 1 hour
crons.interval(
	"expire cards",
	{ hours: 1 },
	internal.cards.expireCards,
);

// Generate monthly invoices daily at midnight UTC
crons.cron(
	"generate invoices",
	"0 0 * * *",
	internal.billing.generateAllInvoices,
);

// Clean old rate limit windows every 1 hour
crons.interval(
	"clean rate limit windows",
	{ hours: 1 },
	internal.apiKeys.cleanOldRateLimitWindows,
);

export default crons;
