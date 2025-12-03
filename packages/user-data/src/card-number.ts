const CARD_NUMBER_LENGTH = 9;

export function normalizeCardNumber(
	raw: string | number | null | undefined,
): string | undefined {
	if (typeof raw !== "string") {
		return undefined;
	}
	const filtered = raw.toString().replace(/\D/g, "");
	const number = parseInt(filtered, 10);
	if (Number.isNaN(number)) {
		return undefined;
	}
	return number.toString().padStart(CARD_NUMBER_LENGTH, "0");
}

export { CARD_NUMBER_LENGTH };
