/**
 * Runtime configuration for the overview application.
 */
export interface OverviewConfig {
	/** Sentry DSN for overview error tracking (null if disabled) */
	overviewSentryDsn: string | null;
	/** Application timezone */
	timezone: string;
	/** Client base URL for login link */
	clientBaseUrl: string | null;
}

let cachedConfig: OverviewConfig | null = null;
let configPromise: Promise<OverviewConfig> | null = null;

/**
 * Fetches the overview configuration from the server.
 * Results are cached to avoid repeated network requests.
 */
export async function fetchConfig(): Promise<OverviewConfig> {
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
			return response.json() as Promise<OverviewConfig>;
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
 */
export function getConfig(): OverviewConfig | null {
	return cachedConfig;
}

/**
 * Pre-load the config.
 */
export function preloadConfig(): void {
	fetchConfig().catch((error) => {
		console.error("Failed to preload config:", error);
	});
}
