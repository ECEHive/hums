import * as Sentry from "@sentry/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ErrorPage } from "@/components/errors/error-page";
import { NotFound } from "@/components/errors/not-found";
import { fetchConfig } from "@/lib/config";
import { routeTree } from "./routeTree.gen";
import "./globals.css";

// Initialize Sentry from runtime config
fetchConfig()
	.then((config) => {
		if (config.dashboardSentryDsn?.trim()) {
			Sentry.init({
				dsn: config.dashboardSentryDsn,
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
	basepath: "/dashboard",
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 3,
			staleTime: 30 * 1000, // 30 seconds
			refetchInterval: 60 * 1000, // 1 minute
		},
	},
});

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
				<RouterProvider router={router} />
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
