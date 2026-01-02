import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "@ecehive/logger";

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
		// Get the directory of this file
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Path to the logo files in the client assets
		const assetsPath = join(__dirname, "..", "assets");

		// Read the SVG files synchronously (at module load time)
		const lightSvg = readFileSync(join(assetsPath, "logo_light.svg"), "utf-8");
		const darkSvg = readFileSync(join(assetsPath, "logo_dark.svg"), "utf-8");

		// Convert to base64 data URLs
		const lightBase64 = Buffer.from(lightSvg).toString("base64");
		const darkBase64 = Buffer.from(darkSvg).toString("base64");

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
