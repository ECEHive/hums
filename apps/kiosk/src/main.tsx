import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import "./kiosk.css";
import * as Sentry from "@sentry/react";
import App from "./App";

if ((import.meta.env.VITE_KIOSK_SENTRY_DSN ?? "").trim().length > 0) {
	Sentry.init({
		dsn: import.meta.env.VITE_KIOSK_SENTRY_DSN,
		sendDefaultPii: true,
		enableLogs: true,
		release: `${__APP_VERSION__}+${__COMMIT_HASH__}`,
	});
}

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
