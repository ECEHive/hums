/**
 * Control Provider Types and Interfaces
 *
 * This module defines the types and interfaces for control providers,
 * which are responsible for communicating with physical equipment controllers.
 */

import { z } from "zod";

/**
 * Base configuration schema for Georgia Tech PLC provider
 */
export const GeorgiaTechPLCProviderConfigSchema = z.object({
	baseUrl: z.url(),
	accessToken: z.string().min(1),
});

export type GeorgiaTechPLCProviderConfig = z.infer<
	typeof GeorgiaTechPLCProviderConfigSchema
>;

/**
 * Configuration schema for a control point using Georgia Tech PLC
 */
export const GeorgiaTechPLCPointConfigSchema = z.object({
	tagName: z.string().min(1),
	ipAddress: z.ipv4(),
});

export type GeorgiaTechPLCPointConfig = z.infer<
	typeof GeorgiaTechPLCPointConfigSchema
>;

/**
 * Union of all provider config schemas
 */
export const ProviderConfigSchemas = {
	GEORGIA_TECH_PLC: GeorgiaTechPLCProviderConfigSchema,
} as const;

/**
 * Union of all point config schemas by provider type
 */
export const PointConfigSchemas = {
	GEORGIA_TECH_PLC: GeorgiaTechPLCPointConfigSchema,
} as const;

/**
 * Result of a control operation
 */
export type ControlOperationResult = {
	success: boolean;
	state?: boolean;
	errorMessage?: string;
};

/**
 * Control Provider Interface
 *
 * All control providers must implement this interface to be used
 * by the control system.
 */
export interface IControlProvider {
	/**
	 * Read the current state of a control point
	 */
	readState(
		providerConfig: unknown,
		pointConfig: unknown,
	): Promise<ControlOperationResult>;

	/**
	 * Write a new state to a control point
	 */
	writeState(
		providerConfig: unknown,
		pointConfig: unknown,
		state: boolean,
		username: string,
	): Promise<ControlOperationResult>;

	/**
	 * Validate provider configuration
	 */
	validateProviderConfig(config: unknown): { valid: boolean; error?: string };

	/**
	 * Validate point configuration
	 */
	validatePointConfig(config: unknown): { valid: boolean; error?: string };
}
