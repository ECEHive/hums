/**
 * Control Provider Registry
 *
 * This module provides a registry of all available control providers
 * and helper functions to work with them.
 */

import type { ControlProviderType } from "@ecehive/prisma";
import { georgiaTechPLCProvider } from "./georgia-tech-plc";
import type { IControlProvider } from "./types";
import { PointConfigSchemas, ProviderConfigSchemas } from "./types";

/**
 * Registry of all available control providers
 */
export const controlProviders: Record<ControlProviderType, IControlProvider> = {
	GEORGIA_TECH_PLC: georgiaTechPLCProvider,
};

/**
 * Get a control provider by type
 */
export function getControlProvider(
	type: ControlProviderType,
): IControlProvider {
	const provider = controlProviders[type];
	if (!provider) {
		throw new Error(`Unknown control provider type: ${type}`);
	}
	return provider;
}

/**
 * Validate provider configuration for a given provider type
 */
export function validateProviderConfig(
	type: ControlProviderType,
	config: unknown,
): { valid: boolean; error?: string } {
	const schema = ProviderConfigSchemas[type];
	if (!schema) {
		return { valid: false, error: `Unknown provider type: ${type}` };
	}
	const result = schema.safeParse(config);
	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues.map((e) => e.message).join(", "),
		};
	}
	return { valid: true };
}

/**
 * Validate point configuration for a given provider type
 */
export function validatePointConfig(
	type: ControlProviderType,
	config: unknown,
): { valid: boolean; error?: string } {
	const schema = PointConfigSchemas[type];
	if (!schema) {
		return { valid: false, error: `Unknown provider type: ${type}` };
	}
	const result = schema.safeParse(config);
	if (!result.success) {
		return {
			valid: false,
			error: result.error.issues.map((e) => e.message).join(", "),
		};
	}
	return { valid: true };
}

export { georgiaTechPLCProvider } from "./georgia-tech-plc";
export * from "./types";
