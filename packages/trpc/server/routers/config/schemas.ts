import { z } from "zod";

/**
 * Get all configuration definitions and current values
 */
export const ZGetAllSchema = z.object({});

/**
 * Get a single configuration value
 */
export const ZGetValueSchema = z.object({
	key: z.string(),
});

/**
 * Set a single configuration value
 */
export const ZSetValueSchema = z.object({
	key: z.string(),
	value: z.unknown(),
});

/**
 * Set multiple configuration values
 */
export const ZSetManySchema = z.object({
	values: z.record(z.string(), z.unknown()),
});

/**
 * Reset a configuration value to default
 */
export const ZResetValueSchema = z.object({
	key: z.string(),
});

/**
 * Search configurations (returns keys matching search term)
 */
export const ZSearchSchema = z.object({
	query: z.string().optional(),
});
