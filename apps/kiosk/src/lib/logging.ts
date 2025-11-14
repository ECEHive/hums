import { Logger } from "tslog";

export const logger = new Logger({
	name: "kiosk",
	type: "pretty",
	prettyLogTemplate: "{{dateIsoStr}} {{logLevelName}} [{{name}}] ",
});

export function getLogger(name?: string) {
	if (name)
		return new Logger({
			name: `kiosk:${name}`,
			type: "pretty",
			prettyLogTemplate: "{{dateIsoStr}} {{logLevelName}} [{{name}}] ",
		});
	return logger;
}

/**
 * Format a log message with key-value pairs
 * Example: formatLog("Card scanned", { cardId: "123456", userId: 42 })
 * Output: "Card scanned | cardId=123456 userId=42"
 */
export function formatLog(
	message: string,
	data?: Record<string, unknown>,
): string {
	if (!data || Object.keys(data).length === 0) {
		return message;
	}

	const parts = Object.entries(data)
		.map(([key, value]) => {
			// Handle different types appropriately
			if (value === null || value === undefined) {
				return `${key}=null`;
			}
			if (typeof value === "string") {
				return `${key}=${value}`;
			}
			if (typeof value === "number" || typeof value === "boolean") {
				return `${key}=${value}`;
			}
			if (typeof value === "object") {
				// For objects, show compact representation
				if (Array.isArray(value)) {
					return `${key}=[${value.length} items]`;
				}
				const keys = Object.keys(value as object);
				return `${key}={${keys.join(",")}}`;
			}
			return `${key}=${String(value)}`;
		})
		.join(" ");

	return `${message} | ${parts}`;
}
