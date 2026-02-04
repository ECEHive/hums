import type { ControlProviderType } from "@ecehive/prisma";
import { georgiaTechPLCProvider } from "./georgia-tech-plc";
import type { IControlProvider } from "./types";
import { PointConfigSchemas, ProviderConfigSchemas } from "./types";

export const controlProviders: Record<ControlProviderType, IControlProvider> = {
	GEORGIA_TECH_PLC: georgiaTechPLCProvider,
};

export function getControlProvider(
	type: ControlProviderType,
): IControlProvider {
	const provider = controlProviders[type];
	if (!provider) {
		throw new Error(`Unknown control provider type: ${type}`);
	}
	return provider;
}

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
