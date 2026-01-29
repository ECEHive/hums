/**
 * Type-safe Configuration Keys
 * Auto-generated from configuration definitions
 *
 * This provides IntelliSense support and compile-time type safety
 * when accessing configuration values.
 */

import type { BrandingConfigType } from "./definitions/branding";
import type { EmailConfigType } from "./definitions/email";
import type { SessionConfigType } from "./definitions/sessions";
import type { SlackConfigType } from "./definitions/slack";

/**
 * Configuration key to type mapping
 * Automatically derived from all registered configuration definitions
 */
export type ConfigKeyMap = SessionConfigType &
	EmailConfigType &
	SlackConfigType &
	BrandingConfigType;

/**
 * Union type of all valid configuration keys
 * Provides autocomplete in IDEs
 */
export type ConfigKey = keyof ConfigKeyMap;

/**
 * Get the value type for a specific configuration key
 */
export type ConfigValueType<K extends ConfigKey> = ConfigKeyMap[K];
