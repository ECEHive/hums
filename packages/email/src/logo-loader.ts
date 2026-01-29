import { getLogger } from "@ecehive/logger";
import LogoDark from "../assets/logo_dark.svg" with { type: "text" };
import LogoLight from "../assets/logo_light.svg" with { type: "text" };

const logger = getLogger("email:logo-loader");

interface EmailLogos {
	light: string;
	dark: string;
}

// Cache logos to avoid reading files multiple times
let cachedLogos: EmailLogos | null = null;

/**
 * Get email logos as base64 data URLs
 * Loads SVG files from client assets and converts them to base64
 * Caches results for performance
 */
export function getEmailLogos(): EmailLogos {
	if (cachedLogos) {
		return cachedLogos;
	}

	try {
		// Convert to base64 data URLs
		const lightBase64 = Buffer.from(LogoLight).toString("base64");
		const darkBase64 = Buffer.from(LogoDark).toString("base64");

		const lightDataUrl = `data:image/svg+xml;base64,${lightBase64}`;
		const darkDataUrl = `data:image/svg+xml;base64,${darkBase64}`;

		// Cache and return
		cachedLogos = {
			light: lightDataUrl,
			dark: darkDataUrl,
		};

		return cachedLogos;
	} catch (error) {
		logger.error("Failed to load email logos", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			light: "",
			dark: "",
		};
	}
}
