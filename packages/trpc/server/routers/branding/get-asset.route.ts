import { BrandingService, type LogoType } from "@ecehive/features";
import type { z } from "zod";
import type { ZGetAssetSchema } from "./schemas";

type GetAssetInput = z.infer<typeof ZGetAssetSchema>;

/**
 * Get a specific branding asset
 */
export async function getAssetHandler({ input }: { input: GetAssetInput }) {
	const asset = await BrandingService.get(input.type as LogoType);

	return {
		type: input.type,
		svgContent: asset.svg,
		isCustom: asset.isCustom,
	};
}
