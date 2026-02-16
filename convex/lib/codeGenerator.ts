export function generateRedemptionCode(length = 16): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

export function generatePin(length = 4): string {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => (byte % 10).toString()).join("");
}

export function generateWebhookSecret(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return "whsec_" + Array.from(array, (byte) => chars[byte % chars.length]).join("");
}
