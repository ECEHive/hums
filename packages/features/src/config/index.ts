/**
 * Configuration Framework
 * Provides a robust system for managing application configuration
 */

export * from "./config-keys";
export * from "./registry";
export * from "./service";
export * from "./types";

// Import all configuration definitions to register them
import "./definitions/sessions";
import "./definitions/email";
import "./definitions/slack";
import "./definitions/branding";

// Re-export branding defaults for use in other packages
export { DEFAULT_BRANDING } from "./definitions/branding";
