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
import { routeTree } from "./routeTree.gen";

if ((import.meta.env.VITE_CLIENT_SENTRY_DSN ?? "").trim().length > 0) {
	Sentry.init({
		dsn: import.meta.env.VITE_CLIENT_SENTRY_DSN,
		sendDefaultPii: true,
		enableLogs: true,
		release: __APP_VERSION__,
	});
}

const router = createRouter({
	routeTree,
	defaultNotFoundComponent: NotFound,
	defaultErrorComponent: ({ error }) => {
		Sentry.captureException(error);
		return <ErrorPage error={error} />;
	},
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// React Query
const queryClient = new QueryClient();

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
