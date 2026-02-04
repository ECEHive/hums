import { z } from "zod";

export const GeorgiaTechPLCProviderConfigSchema = z.object({
	baseUrl: z.string().url(),
	accessToken: z.string().min(1),
});

export type GeorgiaTechPLCProviderConfig = z.infer<
	typeof GeorgiaTechPLCProviderConfigSchema
>;

export const GeorgiaTechPLCPointConfigSchema = z.object({
	tagName: z.string().min(1),
	ipAddress: z
		.string()
		.regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IPv4 address"),
});

export type GeorgiaTechPLCPointConfig = z.infer<
	typeof GeorgiaTechPLCPointConfigSchema
>;

export const ProviderConfigSchemas = {
	GEORGIA_TECH_PLC: GeorgiaTechPLCProviderConfigSchema,
} as const;

export const PointConfigSchemas = {
	GEORGIA_TECH_PLC: GeorgiaTechPLCPointConfigSchema,
} as const;

export type ControlOperationResult = {
	success: boolean;
	state?: boolean;
	errorMessage?: string;
};

export interface IControlProvider {
	readState(
		providerConfig: unknown,
		pointConfig: unknown,
	): Promise<ControlOperationResult>;

	writeState(
		providerConfig: unknown,
		pointConfig: unknown,
		state: boolean,
		username: string,
	): Promise<ControlOperationResult>;

	validateProviderConfig(config: unknown): { valid: boolean; error?: string };

	validatePointConfig(config: unknown): { valid: boolean; error?: string };
}
