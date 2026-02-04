import { useQuery } from "@tanstack/react-query";
import { fetchConfig, getConfig, type KioskConfig } from "@/lib/config";

/**
 * React hook to access the kiosk configuration.
 *
 * The configuration is fetched from /api/config on first use and cached.
 * This replaces the old VITE_* environment variables with runtime values.
 */
export function useConfig() {
	return useQuery<KioskConfig>({
		queryKey: ["kiosk-config"],
		queryFn: fetchConfig,
		staleTime: Number.POSITIVE_INFINITY, // Config doesn't change during a session
		gcTime: Number.POSITIVE_INFINITY,
		retry: 3,
		// Use cached value as initial data if available
		initialData: getConfig() ?? undefined,
	});
}
