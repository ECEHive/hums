/**
 * Runtime configuration for the kiosk application.
 *
 * These values are fetched from the server at runtime, allowing the kiosk
 * to be pre-built as a static bundle without requiring build-time environment variables.
 */
export interface KioskConfig {
	/** Authentication provider type */
	authProvider: "CAS" | "CAS_PROXIED";
	/** CAS login URL (used when authProvider is "CAS") */
	casLoginUrl: string | null;
	/** CAS proxy URL (used when authProvider is "CAS_PROXIED") */
	casProxyUrl: string | null;
	/** Sentry DSN for kiosk error tracking (null if disabled) */
	kioskSentryDsn: string | null;
	/** Application timezone */
	timezone: string;
	/** Client base URL for redirects */
	clientBaseUrl: string | null;
}

let cachedConfig: KioskConfig | null = null;
let configPromise: Promise<KioskConfig> | null = null;

/**
 * Fetches the kiosk configuration from the server.
 * Results are cached to avoid repeated network requests.
 */
export async function fetchConfig(): Promise<KioskConfig> {
	if (cachedConfig) {
		return cachedConfig;
	}

	if (configPromise) {
		return configPromise;
	}

	configPromise = fetch("/api/config")
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Failed to fetch config: ${response.status}`);
			}
			return response.json() as Promise<KioskConfig>;
		})
		.then((config) => {
			cachedConfig = config;
			return config;
		})
		.catch((error) => {
			configPromise = null;
			throw error;
		});

	return configPromise;
}

/**
 * Returns the cached config if available, otherwise null.
 * Use this for synchronous access after config has been loaded.
 */
export function getConfig(): KioskConfig | null {
	return cachedConfig;
}

/**
 * Pre-load the config. Call this early in app initialization.
 */
export function preloadConfig(): void {
	fetchConfig().catch((error) => {
		console.error("Failed to preload config:", error);
	});
}
