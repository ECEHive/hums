import { getLogger } from "@ecehive/logger";
import { DEFAULT_BRANDING } from "./config/definitions/branding";
import { ConfigService } from "./config/service";

const logger = getLogger("features:branding");

/**
 * Branding data structure returned by the BrandingService
 */
export interface BrandingData {
	colors: {
		light: {
			primary: string;
			primaryForeground: string;
			secondary: string;
			secondaryForeground: string;
		};
		dark: {
			primary: string;
			primaryForeground: string;
			secondary: string;
			secondaryForeground: string;
		};
	};
	logos: {
		light: string;
		dark: string;
	};
	favicon: string;
}

/**
 * Cache for branding data to minimize database queries
 */
let cachedBranding: BrandingData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

function isCacheValid(): boolean {
	return cachedBranding !== null && Date.now() - cacheTimestamp < CACHE_TTL;
}

/**
 * Clear the branding cache - useful when config is updated
 */
export function clearBrandingCache(): void {
	cachedBranding = null;
	cacheTimestamp = 0;
	logger.debug("Branding cache cleared");
}

/**
 * Get all branding data with caching
 */
export async function getBranding(): Promise<BrandingData> {
	if (isCacheValid() && cachedBranding) {
		return cachedBranding;
	}

	try {
		const values = await ConfigService.getMany([
			"branding.colors.light.primary",
			"branding.colors.light.primaryForeground",
			"branding.colors.light.secondary",
			"branding.colors.light.secondaryForeground",
			"branding.colors.dark.primary",
			"branding.colors.dark.primaryForeground",
			"branding.colors.dark.secondary",
			"branding.colors.dark.secondaryForeground",
			"branding.logo.light",
			"branding.logo.dark",
			"branding.favicon",
		]);

		cachedBranding = {
			colors: {
				light: {
					primary:
						(values["branding.colors.light.primary"] as string) ??
						DEFAULT_BRANDING.colors.light.primary,
					primaryForeground:
						(values["branding.colors.light.primaryForeground"] as string) ??
						DEFAULT_BRANDING.colors.light.primaryForeground,
					secondary:
						(values["branding.colors.light.secondary"] as string) ??
						DEFAULT_BRANDING.colors.light.secondary,
					secondaryForeground:
						(values["branding.colors.light.secondaryForeground"] as string) ??
						DEFAULT_BRANDING.colors.light.secondaryForeground,
				},
				dark: {
					primary:
						(values["branding.colors.dark.primary"] as string) ??
						DEFAULT_BRANDING.colors.dark.primary,
					primaryForeground:
						(values["branding.colors.dark.primaryForeground"] as string) ??
						DEFAULT_BRANDING.colors.dark.primaryForeground,
					secondary:
						(values["branding.colors.dark.secondary"] as string) ??
						DEFAULT_BRANDING.colors.dark.secondary,
					secondaryForeground:
						(values["branding.colors.dark.secondaryForeground"] as string) ??
						DEFAULT_BRANDING.colors.dark.secondaryForeground,
				},
			},
			logos: {
				light:
					(values["branding.logo.light"] as string) ??
					DEFAULT_BRANDING.logos.light,
				dark:
					(values["branding.logo.dark"] as string) ??
					DEFAULT_BRANDING.logos.dark,
			},
			favicon:
				(values["branding.favicon"] as string) ?? DEFAULT_BRANDING.favicon,
		};

		cacheTimestamp = Date.now();
		logger.debug("Branding data loaded and cached");

		return cachedBranding;
	} catch (error) {
		logger.error("Failed to load branding data, using defaults", {
			error: error instanceof Error ? error.message : String(error),
		});

		// Return defaults on error
		return {
			colors: DEFAULT_BRANDING.colors,
			logos: DEFAULT_BRANDING.logos,
			favicon: DEFAULT_BRANDING.favicon,
		};
	}
}

/**
 * Get favicon SVG content
 */
export async function getFavicon(): Promise<string> {
	const branding = await getBranding();
	return branding.favicon;
}

/**
 * Get logo SVG content for a specific mode
 */
export async function getLogo(mode: "light" | "dark"): Promise<string> {
	const branding = await getBranding();
	return branding.logos[mode];
}

/**
 * Get color values for a specific mode
 */
export async function getColors(
	mode: "light" | "dark",
): Promise<BrandingData["colors"]["light"]> {
	const branding = await getBranding();
	return branding.colors[mode];
}

/**
 * BrandingService - Centralized service for branding data
 */
export const BrandingService = {
	getBranding,
	getFavicon,
	getLogo,
	getColors,
	clearCache: clearBrandingCache,
};
