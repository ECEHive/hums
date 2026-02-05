import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Calculate display duration for a message based on word count.
 * Assumes a reading speed of 200 words per minute with a minimum duration.
 * @param message - The message to calculate duration for
 * @param minDurationMs - Minimum duration in milliseconds (default: 2000ms)
 * @returns Duration in milliseconds
 */
export function calculateReadingDuration(
	message: string,
	minDurationMs = 2000,
): number {
	const WORDS_PER_MINUTE = 230;
	const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
	const readingTimeMs = (wordCount / WORDS_PER_MINUTE) * 60 * 1000;
	return Math.max(minDurationMs, readingTimeMs);
}
