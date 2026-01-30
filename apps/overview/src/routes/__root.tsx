import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DeviceProvider } from "@/components/providers/device-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { useBranding } from "@/hooks/useBranding";

function BrandingLoader() {
	// This component loads and applies branding to the page
	useBranding();
	return null;
}

const RootLayout = () => (
	<>
		<BrandingLoader />
		<ThemeProvider defaultTheme="dark" storageKey="overview-theme">
			<DeviceProvider>
				<Outlet />
			</DeviceProvider>
		</ThemeProvider>
	</>
);

export const Route = createRootRoute({ component: RootLayout });
