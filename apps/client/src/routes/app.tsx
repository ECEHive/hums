import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { AgreementsBanner } from "@/components/banners/agreements-banner";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<RequireAuth>
			<SidebarProvider>
				<AppSidebar />
				<div className="flex flex-col w-full overflow-hidden">
					<ImpersonationBanner />
					<AgreementsBanner />
					<div className="flex flex-row items-center gap-2 p-4 w-full border-b border-border">
						<SidebarTrigger />
						<DynamicBreadcrumbs />
					</div>
					<Outlet />
				</div>
			</SidebarProvider>
		</RequireAuth>
	);
}
