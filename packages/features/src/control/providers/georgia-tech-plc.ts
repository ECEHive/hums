import { getLogger } from "@ecehive/logger";
import type {
	ControlOperationResult,
	GeorgiaTechPLCPointConfig,
	GeorgiaTechPLCProviderConfig,
	IControlProvider,
} from "./types";
import {
	GeorgiaTechPLCPointConfigSchema,
	GeorgiaTechPLCProviderConfigSchema,
} from "./types";

const logger = getLogger("control:georgia-tech-plc");

interface PLCApiResponse {
	Status_Code: number[];
	GUID: string[];
	Value: string[];
	Description: string;
}

export class GeorgiaTechPLCProvider implements IControlProvider {
	validateProviderConfig(config: unknown): { valid: boolean; error?: string } {
		const result = GeorgiaTechPLCProviderConfigSchema.safeParse(config);
		if (!result.success) {
			return {
				valid: false,
				error: result.error.issues.map((e) => e.message).join(", "),
			};
		}
		return { valid: true };
	}

	validatePointConfig(config: unknown): { valid: boolean; error?: string } {
		const result = GeorgiaTechPLCPointConfigSchema.safeParse(config);
		if (!result.success) {
			return {
				valid: false,
				error: result.error.issues.map((e) => e.message).join(", "),
			};
		}
		return { valid: true };
	}

	async readState(
		providerConfig: unknown,
		pointConfig: unknown,
	): Promise<ControlOperationResult> {
		const providerResult =
			GeorgiaTechPLCProviderConfigSchema.safeParse(providerConfig);
		if (!providerResult.success) {
			return {
				success: false,
				errorMessage: "Invalid provider configuration",
			};
		}

		const pointResult = GeorgiaTechPLCPointConfigSchema.safeParse(pointConfig);
		if (!pointResult.success) {
			return {
				success: false,
				errorMessage: "Invalid point configuration",
			};
		}

		const config = providerResult.data as GeorgiaTechPLCProviderConfig;
		const point = pointResult.data as GeorgiaTechPLCPointConfig;

		try {
			const response = await fetch(`${config.baseUrl}/api/BulkTag`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.accessToken,
				},
				body: JSON.stringify({
					readlist: [
						{
							username: "system",
							tagname: point.tagName,
							command: "R",
							ip_address: point.ipAddress,
							datatype: "bool",
						},
					],
				}),
			});

			if (!response.ok) {
				logger.error("PLC API request failed", {
					status: response.status,
					statusText: response.statusText,
				});
				return {
					success: false,
					errorMessage: `PLC API request failed: ${response.status} ${response.statusText}`,
				};
			}

			const data = (await response.json()) as PLCApiResponse;

			if (data.Description !== "Success" || data.Status_Code[0] !== 1) {
				logger.error("PLC API returned error", { data });
				return {
					success: false,
					errorMessage: `PLC API error: ${data.Description}`,
				};
			}

			const state = data.Value[0] === "1";

			return {
				success: true,
				state,
			};
		} catch (error) {
			logger.error("Failed to read PLC state", { error });
			return {
				success: false,
				errorMessage:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	async writeState(
		providerConfig: unknown,
		pointConfig: unknown,
		state: boolean,
		username: string,
	): Promise<ControlOperationResult> {
		const providerResult =
			GeorgiaTechPLCProviderConfigSchema.safeParse(providerConfig);
		if (!providerResult.success) {
			return {
				success: false,
				errorMessage: "Invalid provider configuration",
			};
		}

		const pointResult = GeorgiaTechPLCPointConfigSchema.safeParse(pointConfig);
		if (!pointResult.success) {
			return {
				success: false,
				errorMessage: "Invalid point configuration",
			};
		}

		const config = providerResult.data as GeorgiaTechPLCProviderConfig;
		const point = pointResult.data as GeorgiaTechPLCPointConfig;

		try {
			const response = await fetch(`${config.baseUrl}/api/BulkTag`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": config.accessToken,
				},
				body: JSON.stringify({
					readlist: [
						{
							username: username,
							tagname: point.tagName,
							command: "W",
							ip_address: point.ipAddress,
							datatype: "bool",
							write_value: state ? 1 : 0,
						},
					],
				}),
			});

			if (!response.ok) {
				logger.error("PLC API write request failed", {
					status: response.status,
					statusText: response.statusText,
				});
				return {
					success: false,
					errorMessage: `PLC API request failed: ${response.status} ${response.statusText}`,
				};
			}

			const data = (await response.json()) as PLCApiResponse;

			if (data.Description !== "Success" || data.Status_Code[0] !== 1) {
				logger.error("PLC API write returned error", { data });
				return {
					success: false,
					errorMessage: `PLC API error: ${data.Description}`,
				};
			}

			return {
				success: true,
				state,
			};
		} catch (error) {
			logger.error("Failed to write PLC state", { error });
			return {
				success: false,
				errorMessage:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}
}

export const georgiaTechPLCProvider = new GeorgiaTechPLCProvider();
