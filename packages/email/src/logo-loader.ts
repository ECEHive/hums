import { BrandingService } from "@ecehive/features";

interface EmailLogos {
	light: string;
	dark: string;
}

/**
 * Get email logos as base64 data URLs from the branding system
 * Uses the configurable logos stored in the database
 */
export async function getEmailLogos(): Promise<EmailLogos> {
	const [lightAsset, darkAsset] = await Promise.all([
		BrandingService.getAsset("logo-light"),
		BrandingService.getAsset("logo-dark"),
	]);

	return {
		light: `data:image/svg+xml;base64,${Buffer.from(lightAsset.svgContent).toString("base64")}`,
		dark: `data:image/svg+xml;base64,${Buffer.from(darkAsset.svgContent).toString("base64")}`,
	};
}
