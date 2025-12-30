import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { ConfigRegistry } from "./registry";
import type { ConfigState } from "./types";

/**
 * Configuration Service
 * Handles reading and writing configuration values to the database
 */
const cache = new Map<string, unknown>();
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

function isCacheValid(): boolean {
	return Date.now() - cacheTimestamp < CACHE_TTL;
}

export const ConfigService = {
	/**
	 * Get a single configuration value
	 */
	async get<T = unknown>(key: string): Promise<T> {
		// Check cache first
		if (isCacheValid() && cache.has(key)) {
			return cache.get(key) as T;
		}

		// Fetch from database
		const configValue = await prisma.configValue.findUnique({
			where: { key },
		});

		if (configValue) {
			const value = configValue.value as T;
			cache.set(key, value);
			return value;
		}

		// Return default value if not found
		const defaultValue = ConfigRegistry.getDefault(key) as T;
		return defaultValue;
	},

	/**
	 * Get multiple configuration values
	 */
	async getMany(keys: string[]): Promise<Record<string, unknown>> {
		const result: Record<string, unknown> = {};

		// Check cache first
		const keysToFetch: string[] = [];
		for (const key of keys) {
			if (isCacheValid() && cache.has(key)) {
				result[key] = cache.get(key);
			} else {
				keysToFetch.push(key);
			}
		}

		// Fetch remaining keys from database
		if (keysToFetch.length > 0) {
			const configValues = await prisma.configValue.findMany({
				where: { key: { in: keysToFetch } },
			});

			const dbValues = new Map(configValues.map((cv) => [cv.key, cv.value]));

			for (const key of keysToFetch) {
				const value = dbValues.get(key) ?? ConfigRegistry.getDefault(key);
				result[key] = value;
				cache.set(key, value);
			}
		}

		return result;
	},

	/**
	 * Get all configuration values
	 */
	async getAll(): Promise<ConfigState> {
		// Get all defaults first
		const defaults = ConfigRegistry.getAllDefaults();

		// Fetch all from database
		const configValues = await prisma.configValue.findMany();

		// Merge with defaults (database values override defaults)
		const result: ConfigState = { ...defaults };
		for (const cv of configValues) {
			result[cv.key] = cv.value;
		}

		// Update cache
		cache.clear();
		for (const [key, value] of Object.entries(result)) {
			cache.set(key, value);
		}
		cacheTimestamp = Date.now();

		return result;
	},

	/**
	 * Set a single configuration value
	 */
	async set(key: string, value: unknown): Promise<void> {
		// Validate the value
		const validation = ConfigRegistry.validate(key, value);
		if (!validation.success) {
			throw new Error(validation.error);
		}

		// Upsert to database
		await prisma.configValue.upsert({
			where: { key },
			create: { key, value: value as Prisma.InputJsonValue },
			update: { value: value as Prisma.InputJsonValue },
		});

		// Update cache
		cache.set(key, value);
		cacheTimestamp = Date.now();
	},

	/**
	 * Set multiple configuration values
	 */
	async setMany(values: Record<string, unknown>): Promise<void> {
		// Validate all values first and collect errors
		const errors: string[] = [];
		for (const [key, value] of Object.entries(values)) {
			const validation = ConfigRegistry.validate(key, value);
			if (!validation.success) {
				errors.push(`${key}: ${validation.error}`);
			}
		}

		if (errors.length > 0) {
			throw new Error(`Validation failed: ${errors.join("; ")}`);
		}

		// Use transaction to update all values
		await prisma.$transaction(
			Object.entries(values).map(([key, value]) =>
				prisma.configValue.upsert({
					where: { key },
					create: { key, value: value as Prisma.InputJsonValue },
					update: { value: value as Prisma.InputJsonValue },
				}),
			),
		);

		// Update cache
		for (const [key, value] of Object.entries(values)) {
			cache.set(key, value);
		}
		cacheTimestamp = Date.now();
	},

	/**
	 * Reset a configuration value to its default
	 */
	async reset(key: string): Promise<void> {
		// Use deleteMany instead of delete to avoid error if record doesn't exist
		// (record might not exist if value was never changed from default)
		await prisma.configValue.deleteMany({
			where: { key },
		});

		cache.delete(key);
	},

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		cache.clear();
		cacheTimestamp = 0;
	},
};
