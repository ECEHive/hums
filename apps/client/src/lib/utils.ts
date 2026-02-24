import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Format a decimal hour value into h:mm format.
 * @param decimalHours - Hours as a decimal number (e.g. 1.25)
 * @returns Formatted string (e.g. "1:15")
 */
export function formatDecimalHours(decimalHours: number): string {
	const h = Math.floor(decimalHours);
	const m = Math.round((decimalHours - h) * 60);
	return `${h}:${m.toString().padStart(2, "0")}`;
}
