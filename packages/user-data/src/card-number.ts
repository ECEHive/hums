const CARD_NUMBER_LENGTH = 9;

export function normalizeCardNumber(
	raw: string | number | null | undefined,
): string | undefined {
	if (raw === null || raw === undefined) {
		return undefined;
	}
	const filtered = String(raw).replace(/\D/g, "");
	const number = parseInt(filtered, 10);
	if (Number.isNaN(number)) {
		return undefined;
	}
	return number.toString().padStart(CARD_NUMBER_LENGTH, "0");
}

export { CARD_NUMBER_LENGTH };
