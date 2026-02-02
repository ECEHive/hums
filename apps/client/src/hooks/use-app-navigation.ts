import { useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import {
	appModules,
	getCurrentModule,
	isAdminPath,
} from "@/components/navigation/nav-config";
import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "app-navigation-state";

type AppNavigationState = {
	[moduleId: string]: string;
};

/**
 * Hook to manage navigation state across app modules.
 * Remembers the last visited page for each sub-app.
 */
export function useAppNavigation() {
	const location = useLocation();
	const pathname = location?.pathname ?? "/";

	const [state, setState] = useLocalStorage<AppNavigationState>(
		STORAGE_KEY,
		{},
	);

	const currentModule = getCurrentModule(pathname);
	const isAdmin = isAdminPath(pathname);

	// Update the saved path when navigating within a module
	useEffect(() => {
		if (isAdmin) {
			// Save admin path
			setState((prev) => ({
				...prev,
				admin: pathname,
			}));
		} else if (currentModule) {
			// Save module path
			setState((prev) => ({
				...prev,
				[currentModule.id]: pathname,
			}));
		}
	}, [pathname, currentModule, isAdmin, setState]);

	// Get the saved path for a module, or fall back to basePath
	const getSavedPath = useCallback(
		(moduleId: string, basePath: string): string => {
			return state[moduleId] ?? basePath;
		},
		[state],
	);

	// Get paths for all modules with saved state
	const modulePaths = useMemo(() => {
		const paths: Record<string, string> = {};
		for (const module of appModules) {
			paths[module.id] = state[module.id] ?? module.basePath;
		}
		// Include admin
		paths.admin = state.admin ?? "/app/users";
		return paths;
	}, [state]);

	return {
		currentModule,
		isAdmin,
		getSavedPath,
		modulePaths,
	};
}
