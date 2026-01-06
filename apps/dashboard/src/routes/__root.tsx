import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DeviceProvider } from "@/components/providers/device-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const RootLayout = () => (
	<ThemeProvider defaultTheme="dark" storageKey="dashboard-theme">
		<DeviceProvider>
			<Outlet />
		</DeviceProvider>
	</ThemeProvider>
);

export const Route = createRootRoute({ component: RootLayout });
