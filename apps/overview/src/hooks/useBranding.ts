import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Branding data structure from the API
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

let cachedBranding: BrandingData | null = null;

/**
 * Fetches branding data from the server
 */
async function fetchBranding(): Promise<BrandingData> {
	if (cachedBranding) {
		return cachedBranding;
	}

	const response = await fetch("/api/branding");
	if (!response.ok) {
		throw new Error("Failed to fetch branding");
	}

	cachedBranding = await response.json();
	return cachedBranding as BrandingData;
}

/**
 * Apply branding colors as CSS variables via a style element
 * This ensures the branding colors override the default CSS
 */
function applyBrandingColors(branding: BrandingData) {
	// Create or update branding styles
	let styleElement = document.getElementById("branding-colors");
	if (!styleElement) {
		styleElement = document.createElement("style");
		styleElement.id = "branding-colors";
		document.head.appendChild(styleElement);
	}

	// Use high specificity selectors to override default CSS
	styleElement.textContent = `
		:root {
			--primary: ${branding.colors.light.primary} !important;
			--primary-foreground: ${branding.colors.light.primaryForeground} !important;
			--secondary: ${branding.colors.light.secondary} !important;
			--secondary-foreground: ${branding.colors.light.secondaryForeground} !important;
		}
		.dark, :root.dark, html.dark {
			--primary: ${branding.colors.dark.primary} !important;
			--primary-foreground: ${branding.colors.dark.primaryForeground} !important;
			--secondary: ${branding.colors.dark.secondary} !important;
			--secondary-foreground: ${branding.colors.dark.secondaryForeground} !important;
		}
	`;
}

/**
 * Hook to access branding data and apply it to the page
 */
export function useBranding() {
	const query = useQuery<BrandingData>({
		queryKey: ["branding"],
		queryFn: fetchBranding,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
		retry: 3,
		initialData: cachedBranding ?? undefined,
	});

	// Apply branding colors when data is available
	useEffect(() => {
		if (query.data) {
			applyBrandingColors(query.data);
		}
	}, [query.data]);

	return query;
}

/**
 * Get logo SVG as a data URL for use in img src
 */
export function getLogoDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Hook to get the logo for the current theme mode
 */
export function useLogo(mode: "light" | "dark") {
	const { data: branding } = useBranding();

	if (!branding) {
		return null;
	}

	return branding.logos[mode];
}

/**
 * Pre-load branding data
 */
export function preloadBranding(): void {
	fetchBranding().catch((error) => {
		console.error("Failed to preload branding:", error);
	});
}
