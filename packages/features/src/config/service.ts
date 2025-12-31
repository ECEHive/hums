import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import type { ConfigKey, ConfigValueType } from "./config-keys";
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

/**
 * Get a single configuration value with type safety
 *
 * @example
 * const enabled = await ConfigService.get("email.users.welcome.enabled"); // boolean
 * const hours = await ConfigService.get("session.timeout.regular.hours"); // number
 */
async function get<K extends ConfigKey>(key: K): Promise<ConfigValueType<K>>;
async function get<T = unknown>(key: string): Promise<T>;
async function get<T = unknown>(key: string): Promise<T> {
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
}

/**
 * Get multiple configuration values with type safety
 *
 * @example
 * const values = await ConfigService.getMany([
 *   "email.users.welcome.enabled",
 *   "session.timeout.regular.hours"
 * ]);
 * // values["email.users.welcome.enabled"] is boolean
 * // values["session.timeout.regular.hours"] is number
 */
async function getMany<K extends ConfigKey>(
	keys: readonly K[],
): Promise<{ [P in K]: ConfigValueType<P> }>;
async function getMany(
	keys: readonly string[],
): Promise<Record<string, unknown>>;
async function getMany(
	keys: readonly string[],
): Promise<Record<string, unknown>> {
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
}

/**
 * Get all configuration values
 */
async function getAll(): Promise<ConfigState> {
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
}

/**
 * Set a single configuration value with type safety
 *
 * @example
 * await ConfigService.set("email.users.welcome.enabled", true); // Type-checked
 * await ConfigService.set("session.timeout.regular.hours", 12); // Type-checked
 */
async function set<K extends ConfigKey>(
	key: K,
	value: ConfigValueType<K>,
): Promise<void>;
async function set(key: string, value: unknown): Promise<void>;
async function set(key: string, value: unknown): Promise<void> {
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
}

/**
 * Set multiple configuration values
 */
async function setMany(values: Record<string, unknown>): Promise<void> {
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

	// Clear cache to avoid serving stale data for other keys in multi-process scenarios
	cache.clear();
	cacheTimestamp = 0;
}

/**
 * Reset a configuration value to its default
 */
async function reset(key: string): Promise<void> {
	// Use deleteMany instead of delete to avoid error if record doesn't exist
	// (record might not exist if value was never changed from default)
	await prisma.configValue.deleteMany({
		where: { key },
	});

	cache.delete(key);
}

/**
 * Clear the cache
 */
function clearCache(): void {
	cache.clear();
	cacheTimestamp = 0;
}

export const ConfigService = {
	get,
	getMany,
	getAll,
	set,
	setMany,
	reset,
	clearCache,
};
