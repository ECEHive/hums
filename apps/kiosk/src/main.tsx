import * as Sentry from "@sentry/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./globals.css";
import { fetchConfig } from "./lib/config";

// Initialize Sentry from runtime config
fetchConfig()
	.then((config) => {
		if (config.kioskSentryDsn?.trim()) {
			Sentry.init({
				dsn: config.kioskSentryDsn,
				sendDefaultPii: true,
				enableLogs: true,
				release: __APP_VERSION__,
			});
		}
	})
	.catch((error) => {
		console.error("Failed to load config for Sentry initialization:", error);
	});

const queryClient = new QueryClient();

// Render root
const rootElement = document.getElementById("root");
if (!rootElement) {
	alert("Unable to load page. Please try again later.");
	throw new Error("Root element `#root` not found in document");
}
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	// Force dark mode at the root
	document.documentElement.classList.add("dark");
	root.render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<App />
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
