import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { EMAIL_MAX_RETRIES } from "./lib/constants.js";

// ─── Send Gift Card (Internal Action) ──────────────────────────────

/**
 * Compose and send a gift card delivery email via Resend.
 * On failure, queues the email for retry.
 */
export const sendGiftCard = internalAction({
	args: {
		recipientEmail: v.string(),
		recipientName: v.optional(v.string()),
		senderName: v.optional(v.string()),
		merchantName: v.string(),
		cardNumber: v.string(),
		code: v.string(),
		balance: v.number(),
		currency: v.string(),
		expiresAt: v.optional(v.number()),
		message: v.optional(v.string()),
		merchantId: v.optional(v.id("merchants")),
	},
	returns: v.boolean(),
	handler: async (ctx, args): Promise<boolean> => {
		const formattedBalance = (args.balance / 100).toFixed(2);
		const expiryText = args.expiresAt
			? `Expires: ${new Date(args.expiresAt).toLocaleDateString()}`
			: "";

		const subject = `You received a ${args.currency} $${formattedBalance} gift card from ${args.merchantName}!`;

		const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
	<h1 style="color: #333;">You've received a gift card!</h1>
	${args.senderName ? `<p>${args.senderName} sent you a gift card from <strong>${args.merchantName}</strong>.</p>` : `<p>You've received a gift card from <strong>${args.merchantName}</strong>.</p>`}
	${args.message ? `<p style="padding: 16px; background: #f5f5f5; border-radius: 8px; font-style: italic;">"${args.message}"</p>` : ""}
	<div style="background: #f9f9f9; border: 2px solid #e0e0e0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
		<p style="font-size: 14px; color: #666; margin: 0 0 8px;">Gift Card Balance</p>
		<p style="font-size: 36px; font-weight: bold; color: #111; margin: 0;">${args.currency} $${formattedBalance}</p>
		<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 16px 0;">
		<p style="font-size: 14px; color: #666; margin: 0 0 4px;">Card Number</p>
		<p style="font-size: 18px; font-weight: bold; color: #333; margin: 0 0 12px; letter-spacing: 2px;">${args.cardNumber}</p>
		<p style="font-size: 14px; color: #666; margin: 0 0 4px;">Redemption Code</p>
		<p style="font-size: 18px; font-weight: bold; color: #333; margin: 0; letter-spacing: 2px;">${args.code}</p>
		${expiryText ? `<p style="font-size: 12px; color: #999; margin: 16px 0 0;">${expiryText}</p>` : ""}
	</div>
	<p style="font-size: 12px; color: #999;">This email was sent by ${args.merchantName} via Logif.</p>
</body>
</html>`;

		const textBody = `You've received a gift card from ${args.merchantName}!\n\nBalance: ${args.currency} $${formattedBalance}\nCard Number: ${args.cardNumber}\nRedemption Code: ${args.code}\n${expiryText}\n${args.message ? `\nMessage: "${args.message}"` : ""}`;

		const success = await ctx.runAction(internal.email.sendEmail, {
			to: args.recipientEmail,
			from: `${args.merchantName} via Logif <noreply@logif.com>`,
			subject,
			htmlBody,
			textBody,
		});

		if (!success) {
			// Queue for retry
			await ctx.runMutation(internal.email.queueEmail, {
				merchantId: args.merchantId,
				to: args.recipientEmail,
				from: `${args.merchantName} via Logif <noreply@logif.com>`,
				subject,
				htmlBody,
				textBody,
				metadata: {
					type: "gift_card_delivery",
					cardNumber: args.cardNumber,
					recipientName: args.recipientName,
				},
			});
		}

		return success;
	},
});

// ─── Queue Email (Internal Mutation) ────────────────────────────────

/**
 * Add an email to the queue table with status "pending" and attempts 0.
 */
export const queueEmail = internalMutation({
	args: {
		merchantId: v.optional(v.id("merchants")),
		to: v.string(),
		from: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.string(),
		textBody: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	returns: v.id("emailQueue"),
	handler: async (ctx, args) => {
		const emailId = await ctx.db.insert("emailQueue", {
			merchantId: args.merchantId,
			to: args.to,
			from: args.from,
			subject: args.subject,
			htmlBody: args.htmlBody,
			textBody: args.textBody,
			status: "pending",
			attempts: 0,
			metadata: args.metadata,
		});

		return emailId;
	},
});

// ─── Process Email Queue (Internal Mutation) ────────────────────────

/**
 * Process pending emails from the queue.
 * For each pending email, schedule the sendEmail action.
 * Called by cron every minute.
 */
export const processEmailQueue = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const pendingEmails = await ctx.db
			.query("emailQueue")
			.withIndex("by_status", (q) => q.eq("status", "pending"))
			.take(20);

		let processed = 0;

		for (const email of pendingEmails) {
			if (email.attempts >= EMAIL_MAX_RETRIES) {
				// Max retries reached, mark as failed
				await ctx.db.patch(email._id, {
					status: "failed",
					lastAttemptAt: Date.now(),
				});
				continue;
			}

			// Increment attempts and schedule the send
			await ctx.db.patch(email._id, {
				attempts: email.attempts + 1,
				lastAttemptAt: Date.now(),
			});

			await ctx.scheduler.runAfter(0, internal.email.sendQueuedEmail, {
				emailQueueId: email._id,
				to: email.to,
				from: email.from,
				subject: email.subject,
				htmlBody: email.htmlBody,
				textBody: email.textBody,
			});

			processed++;
		}

		return processed;
	},
});

// ─── Send Queued Email (Internal Action) ────────────────────────────

/**
 * Send a queued email and update its status.
 */
export const sendQueuedEmail = internalAction({
	args: {
		emailQueueId: v.id("emailQueue"),
		to: v.string(),
		from: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.string(),
		textBody: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const success = await ctx.runAction(internal.email.sendEmail, {
			to: args.to,
			from: args.from,
			subject: args.subject,
			htmlBody: args.htmlBody,
			textBody: args.textBody,
		});

		await ctx.runMutation(internal.email.updateEmailStatus, {
			emailQueueId: args.emailQueueId,
			success,
		});

		return null;
	},
});

// ─── Update Email Status (Internal Mutation) ────────────────────────

/**
 * Update the status of a queued email after a send attempt.
 */
export const updateEmailStatus = internalMutation({
	args: {
		emailQueueId: v.id("emailQueue"),
		success: v.boolean(),
		errorMessage: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.success) {
			await ctx.db.patch(args.emailQueueId, {
				status: "sent",
				sentAt: Date.now(),
			});
		} else {
			const email = await ctx.db.get(args.emailQueueId);
			if (!email) return null;

			if (email.attempts >= EMAIL_MAX_RETRIES) {
				await ctx.db.patch(args.emailQueueId, {
					status: "failed",
					errorMessage: args.errorMessage ?? "Max retries exceeded",
				});
			}
			// Otherwise leave as "pending" for next processEmailQueue cycle
		}

		return null;
	},
});

// ─── Send Email (Internal Action) ───────────────────────────────────

/**
 * Generic email send via Resend API.
 * Returns true on success, false on failure.
 */
export const sendEmail = internalAction({
	args: {
		to: v.string(),
		from: v.optional(v.string()),
		subject: v.string(),
		htmlBody: v.string(),
		textBody: v.optional(v.string()),
	},
	returns: v.boolean(),
	handler: async (_ctx, args) => {
		const apiKey = process.env.RESEND_API_KEY;
		if (!apiKey) {
			console.error("RESEND_API_KEY environment variable is not set");
			return false;
		}

		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: args.from ?? "Logif <noreply@logif.com>",
					to: [args.to],
					subject: args.subject,
					html: args.htmlBody,
					text: args.textBody,
				}),
			});

			if (!response.ok) {
				const errorBody = await response.text();
				console.error(
					`Resend API error: ${response.status} ${errorBody}`,
				);
				return false;
			}

			return true;
		} catch (error) {
			console.error("Failed to send email via Resend:", error);
			return false;
		}
	},
});
