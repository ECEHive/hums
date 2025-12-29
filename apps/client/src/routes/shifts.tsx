import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { ShiftsSidebar } from "@/components/navigation/shifts-sidebar";
import { PeriodProvider } from "@/components/providers/period-provider";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/shifts")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<RequireAuth>
			<PeriodProvider>
				<SidebarProvider>
					<ShiftsSidebar />
					<div className="flex flex-col w-full overflow-hidden">
						<ImpersonationBanner />
						<div className="flex flex-row items-center gap-2 p-4 w-full border-b border-border">
							<SidebarTrigger />
							<DynamicBreadcrumbs />
						</div>
						<Outlet />
					</div>
				</SidebarProvider>
			</PeriodProvider>
		</RequireAuth>
	);
}
