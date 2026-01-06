import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { NotFound } from "@/components/errors/not-found";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import * as Sentry from "@sentry/react";
import { ErrorPage } from "./components/errors/error-page";
import { fetchConfig } from "./lib/config";
import { routeTree } from "./routeTree.gen";

// Initialize Sentry from runtime config
fetchConfig()
	.then((config) => {
		if (config.clientSentryDsn?.trim()) {
			Sentry.init({
				dsn: config.clientSentryDsn,
				sendDefaultPii: true,
				enableLogs: true,
				release: __APP_VERSION__,
			});
		}
	})
	.catch((error) => {
		console.error("Failed to load config for Sentry initialization:", error);
	});

const router = createRouter({
	routeTree,
	defaultNotFoundComponent: NotFound,
	defaultErrorComponent: ({ error }) => {
		Sentry.captureException(error);
		return <ErrorPage error={error} />;
	},
	defaultViewTransition: true,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// Shared error handler for UNAUTHORIZED errors
const handleUnauthorizedError = (error: unknown) => {
	if (error && typeof error === "object") {
		let isUnauthorized = false;

		// Check both error.name and error.data.code for UNAUTHORIZED
		if ("name" in error && error.name === "UNAUTHORIZED") {
			isUnauthorized = true;
		}
		if ("data" in error) {
			const dataError = error as { data?: { code?: string } };
			if (dataError.data?.code === "UNAUTHORIZED") {
				isUnauthorized = true;
			}
		}

		if (isUnauthorized) {
			// Only redirect if not on login or ota-session-login pages
			const pathname = window.location.pathname;
			if (!pathname.startsWith("/login") && pathname !== "/ota-session-login") {
				// Clear the auth token
				localStorage.removeItem("auth_token");
				// Redirect to login with current path as redirect
				const currentPath = window.location.pathname + window.location.search;
				const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
				window.location.href = loginUrl;
			}
		}
	}
};

// React Query
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) => {
				// Don't retry on UNAUTHORIZED errors
				if (error && typeof error === "object") {
					// Check both error.name and error.data.code for UNAUTHORIZED
					if ("name" in error && error.name === "UNAUTHORIZED") {
						return false;
					}
					if ("data" in error) {
						const dataError = error as { data?: { code?: string } };
						if (dataError.data?.code === "UNAUTHORIZED") {
							return false;
						}
					}
				}
				return failureCount < 3;
			},
		},
	},
});

// Global error handler for React Query
queryClient.getQueryCache().config = {
	...queryClient.getQueryCache().config,
	onError: handleUnauthorizedError,
};

queryClient.getMutationCache().config = {
	...queryClient.getMutationCache().config,
	onError: handleUnauthorizedError,
};

// Render root
const rootElement = document.getElementById("root");
if (!rootElement) {
	alert("Unable to load page. Please try again later.");
	throw new Error("Root element `#root` not found in document");
}
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider defaultTheme="dark" storageKey="ui-theme">
					<RouterProvider router={router} />
					<Toaster />
				</ThemeProvider>
				<TanStackDevtools
					plugins={[
						{
							name: "TanStack Query",
							render: <ReactQueryDevtoolsPanel />,
						},
					]}
				/>
			</QueryClientProvider>
		</StrictMode>,
	);
}
