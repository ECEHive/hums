import {
	BrandingService,
	ConfigRegistry,
	ConfigService,
	clearEmailLogoCache,
} from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { ZSetValueSchema } from "./schemas";

type SetValueInput = z.infer<typeof ZSetValueSchema>;

export async function setValueHandler({
	input,
}: {
	input: SetValueInput;
}): Promise<void> {
	// Ensure the key exists in the registry
	const defaultValue = ConfigRegistry.getDefault(input.key);
	if (defaultValue === undefined) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Unknown configuration key: ${input.key}`,
		});
	}

	try {
		await ConfigService.set(input.key, input.value);

		// Clear branding caches if a branding key was updated
		if (input.key.startsWith("branding.")) {
			BrandingService.clearCache();
			clearEmailLogoCache();
		}
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error
					? error.message
					: `Failed to set configuration: ${String(error)}`,
		});
	}
}
