/**
 * Runtime configuration for the dashboard application.
 */
export interface DashboardConfig {
	/** Sentry DSN for dashboard error tracking (null if disabled) */
	dashboardSentryDsn: string | null;
	/** Application timezone */
	timezone: string;
	/** Client base URL for login link */
	clientBaseUrl: string | null;
}

let cachedConfig: DashboardConfig | null = null;
let configPromise: Promise<DashboardConfig> | null = null;

/**
 * Fetches the dashboard configuration from the server.
 * Results are cached to avoid repeated network requests.
 */
export async function fetchConfig(): Promise<DashboardConfig> {
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
			return response.json() as Promise<DashboardConfig>;
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
export function getConfig(): DashboardConfig | null {
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
