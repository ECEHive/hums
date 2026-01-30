import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/auth/AuthProvider";
import { useBranding } from "@/hooks/useBranding";

function BrandingLoader() {
	// This component loads and applies branding to the page
	useBranding();
	return null;
}

const RootLayout = () => (
	<>
		<BrandingLoader />
		<AuthProvider>
			<Outlet />
		</AuthProvider>
	</>
);

export const Route = createRootRoute({ component: RootLayout });
