import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRouter, Link, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Icon404 } from "@/components/logo";
import { ThemeProvider } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import "./globals.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const NotFound = () => (
	<div className="flex justify-center p-6">
		<Card className="max-w-lg w-full text-center">
			<h1 className="text-2xl font-semibold mb-2">Page not found</h1>
			<div className="flex items-center justify-center gap-3">
				<Button variant="ghost" onClick={() => window.history.back()}>
					Back
				</Button>
				<Link to="/app">
					<Button>Home</Button>
				</Link>
			</div>
		</Card>
	</div>
);

const router = createRouter({
	routeTree,
	defaultNotFoundComponent: NotFound,
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
