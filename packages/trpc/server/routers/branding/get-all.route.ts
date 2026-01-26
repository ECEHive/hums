import { BrandingService, type LogoType } from "@ecehive/features";

/**
 * Get all branding assets
 */
export async function getAllHandler() {
	const assets = await BrandingService.getAll();
	const defaults = BrandingService.getDefaults();

	return {
		assets: Object.entries(assets).map(([type, data]) => ({
			type: type as LogoType,
			svgContent: data.svg,
			isCustom: data.isCustom,
		})),
		defaults: Object.entries(defaults).map(([type, svg]) => ({
			type: type as LogoType,
			svgContent: svg,
		})),
	};
}
