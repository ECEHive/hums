import { z } from "zod";

/**
 * Logo types
 */
export const ZLogoType = z.enum(["logo-light", "logo-dark", "favicon"]);

/**
 * Get a specific branding asset
 */
export const ZGetAssetSchema = z.object({
	type: ZLogoType,
});
