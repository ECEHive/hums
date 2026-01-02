import { type ILogObj, type ISettingsParam, Logger } from "tslog";

/**
 * Base logger settings optimized for production server-side logging
 */
const baseSettings: ISettingsParam<ILogObj> = {
	type: process.env.NODE_ENV === "production" ? "json" : "pretty",
	// Hide log position for production to improve performance
	hideLogPositionForProduction: true,
	// Mask sensitive fields
	maskValuesOfKeys: [
		"password",
		"token",
		"apiKey",
		"secret",
		"authorization",
		"cookie",
		"sessionId",
	],
	maskValuesOfKeysCaseInsensitive: true,
	// Pretty log template for development
	prettyLogTemplate:
		"{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}}\t{{logLevelName}}\t[{{name}}]\t",
	prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\n{{errorStack}}",
	prettyErrorStackTemplate:
		"  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}",
	// Set minimum log level based on environment
	minLevel: process.env.LOG_LEVEL
		? (parseInt(process.env.LOG_LEVEL, 10) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
		: process.env.NODE_ENV === "production"
			? 3 // info and above in production
			: 2, // debug and above in development
};

/**
 * Root logger instance
 */
const rootLogger = new Logger<ILogObj>(baseSettings);

/**
 * Get a named logger for a specific module or component
 *
 * @param name - The name of the logger (e.g., "auth", "database", "email")
 * @returns A logger instance with the specified name
 *
 * @example
 * ```typescript
 * const logger = getLogger("auth");
 * logger.info("User authenticated");
 * logger.error("Authentication failed", { username: "user123" });
 * ```
 */
export function getLogger(name: string): Logger<ILogObj> {
	return rootLogger.getSubLogger({ name });
}

/**
 * Get the root logger instance
 * This should rarely be used directly - prefer getLogger() with a name
 */
export function getRootLogger(): Logger<ILogObj> {
	return rootLogger;
}

// Export tslog types for convenience
export type { ILogObj, Logger } from "tslog";
