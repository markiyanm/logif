import {
	CARD_NUMBER_PREFIX,
	CARD_NUMBER_SEGMENTS,
	CARD_NUMBER_SEGMENT_LENGTH,
} from "./constants.js";

function generateSegment(length: number): string {
	const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // No I or O to avoid confusion
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

export function generateCardNumber(): string {
	const segments: string[] = [CARD_NUMBER_PREFIX];
	for (let i = 1; i < CARD_NUMBER_SEGMENTS; i++) {
		segments.push(generateSegment(CARD_NUMBER_SEGMENT_LENGTH));
	}
	return segments.join("-");
}

export function isValidCardNumber(cardNumber: string): boolean {
	const pattern = new RegExp(
		`^${CARD_NUMBER_PREFIX}-[0-9A-HJ-NP-Z]{${CARD_NUMBER_SEGMENT_LENGTH}}-[0-9A-HJ-NP-Z]{${CARD_NUMBER_SEGMENT_LENGTH}}-[0-9A-HJ-NP-Z]{${CARD_NUMBER_SEGMENT_LENGTH}}$`,
	);
	return pattern.test(cardNumber);
}
