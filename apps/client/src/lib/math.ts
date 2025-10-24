/**
 * Clamp a value between a minimum and maximum
 */
export function clamp(value: number, min = 0, max = 255): number {
	return Math.min(Math.max(value, min), max);
}
