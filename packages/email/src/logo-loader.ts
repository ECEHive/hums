import { BrandingService } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";

const logger = getLogger("email:logo-loader");

interface EmailLogos {
	light: string;
	dark: string;
}

// Cache logos to avoid repeated config lookups
let cachedLogos: EmailLogos | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

function isCacheValid(): boolean {
	return cachedLogos !== null && Date.now() - cacheTimestamp < CACHE_TTL;
}

/**
 * Clear the email logo cache - useful when branding is updated
 */
export function clearEmailLogoCache(): void {
	cachedLogos = null;
	cacheTimestamp = 0;
	logger.debug("Email logo cache cleared");
}

/**
 * Get email logos as base64 data URLs
 * Loads SVG content from the branding configuration
 * Caches results for performance
 */
export async function getEmailLogosAsync(): Promise<EmailLogos> {
	if (isCacheValid() && cachedLogos) {
		return cachedLogos;
	}

	try {
		const branding = await BrandingService.getBranding();

		// Convert to base64 data URLs
		const lightBase64 = Buffer.from(branding.logos.light).toString("base64");
		const darkBase64 = Buffer.from(branding.logos.dark).toString("base64");

		const lightDataUrl = `data:image/svg+xml;base64,${lightBase64}`;
		const darkDataUrl = `data:image/svg+xml;base64,${darkBase64}`;

		// Cache and return
		cachedLogos = {
			light: lightDataUrl,
			dark: darkDataUrl,
		};
		cacheTimestamp = Date.now();

		return cachedLogos;
	} catch (error) {
		logger.error("Failed to load email logos from branding config", {
			error: error instanceof Error ? error.message : String(error),
		});

		// Return empty strings on error
		return {
			light: "",
			dark: "",
		};
	}
}

/**
 * Get email logos synchronously (uses cached value or returns empty)
 * @deprecated Use getEmailLogosAsync instead
 */
export function getEmailLogos(): EmailLogos {
	if (cachedLogos) {
		return cachedLogos;
	}

	// Trigger async load for next time
	getEmailLogosAsync().catch((error) => {
		logger.error("Failed to preload email logos", {
			error: error instanceof Error ? error.message : String(error),
		});
	});

	// Return empty - caller should use async version
	return {
		light: "",
		dark: "",
	};
}
