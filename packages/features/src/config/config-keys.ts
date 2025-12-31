/**
 * Type-safe Configuration Keys
 * Auto-generated from configuration definitions
 *
 * This provides IntelliSense support and compile-time type safety
 * when accessing configuration values.
 */

import type { EmailConfigType } from "./definitions/email";
import type { SessionConfigType } from "./definitions/sessions";

/**
 * Configuration key to type mapping
 * Automatically derived from all registered configuration definitions
 */
export type ConfigKeyMap = SessionConfigType & EmailConfigType;

/**
 * Union type of all valid configuration keys
 * Provides autocomplete in IDEs
 */
export type ConfigKey = keyof ConfigKeyMap;

/**
 * Get the value type for a specific configuration key
 */
export type ConfigValueType<K extends ConfigKey> = ConfigKeyMap[K];
