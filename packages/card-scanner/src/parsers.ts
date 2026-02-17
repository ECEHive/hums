import type { CardFormatParser } from "./types";

const CARD_NUMBER_LENGTH = 9;
const IIN_LENGTH = 6;
const MOBILE_CREDENTIAL_LENGTH = 16;
const MOBILE_CREDENTIAL_IIN = "601770";

/**
 * Normalize a digit string to a zero-padded card number of `length` digits.
 * Strips all non-digit characters first.
 */
function normalizeDigits(
	raw: string,
	length = CARD_NUMBER_LENGTH,
): string | null {
	const digits = raw.replace(/\D/g, "");
	if (!digits) return null;
	return digits.length >= length
		? digits.slice(-length)
		: digits.padStart(length, "0");
}

/**
 * Mobile credential format.
 *
 * Matches 16-digit mobile credentials that start with the IIN "601770".
 * Returns the entire credential value without truncation.
 *
 * Example:
 *   "6000000010000000\r"  → "6000000010000000"
 */
const mobileCredentialParser: CardFormatParser = {
	name: "mobile-credential",
	parse(raw: string): string | null {
		const s = raw.trim();
		if (!s || s.includes("=")) return null;
		const digits = s.replace(/\D/g, "");

		// Check if it matches mobile credential format: 16 digits starting with IIN
		if (
			digits.length === MOBILE_CREDENTIAL_LENGTH &&
			digits.startsWith(MOBILE_CREDENTIAL_IIN)
		) {
			return digits;
		}

		return null;
	},
};

/**
 * Traditional 9-digit card number format.
 *
 * Matches raw strings that consist only of digits (possibly with whitespace)
 * and returns the last 9 digits, zero-padded.
 *
 * Examples:
 *   "12345"        → "000012345"
 */
const traditionalParser: CardFormatParser = {
	name: "traditional",
	parse(raw: string): string | null {
		const s = raw.trim();
		if (!s || s.includes("=")) return null;
		return normalizeDigits(s);
	},
};

/**
 * Magstripe (ISO 7811) track-2 format.
 *
 * Matches raw data containing '=' separators. Extracts the account portion
 * from the last segment by stripping the IIN prefix (6 digits) and the
 * trailing Luhn checksum digit, then returns the last 9 digits.
 *
 * Example:
 *   "...=...=6000000001234560\r"
 *   → IIN "600000", account+check "0001234560", account "000123456"
 */
const magstripeParser: CardFormatParser = {
	name: "magstripe",
	parse(raw: string): string | null {
		const s = raw.trim();
		if (!s || !s.includes("=")) return null;
		const parts = s.split("=");
		const last = parts[parts.length - 1] ?? "";
		const digits = last.replace(/\D/g, "");
		if (!digits) return null;
		if (digits.length >= CARD_NUMBER_LENGTH + IIN_LENGTH + 1) {
			const accountPortion = digits.slice(IIN_LENGTH, -1);
			if (accountPortion.length >= CARD_NUMBER_LENGTH) {
				return accountPortion
					.slice(-CARD_NUMBER_LENGTH)
					.padStart(CARD_NUMBER_LENGTH, "0");
			}
		}
		return normalizeDigits(last);
	},
};

/**
 * Built-in card format parsers, tried in order.
 */
export const builtinParsers: CardFormatParser[] = [
	mobileCredentialParser,
	magstripeParser,
	traditionalParser,
];

/**
 * Create a composite parser from a list of format parsers.
 * Returns the result of the first parser that produces a non-null value.
 */
export function createCardParser(
	parsers: CardFormatParser[] = builtinParsers,
): (raw: string) => string | null {
	return (raw: string): string | null => {
		for (const parser of parsers) {
			const result = parser.parse(raw);
			if (result !== null) return result;
		}
		return null;
	};
}
