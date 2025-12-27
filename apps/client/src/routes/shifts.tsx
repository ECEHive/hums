import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { PeriodProvider } from "@/components/providers/period-provider";
import { ShiftsSidebar } from "@/components/navigation/shifts-sidebar";
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
						<div className="flex flex-row p-4 w-full border-b border-border">
							<SidebarTrigger />
						</div>
						<Outlet />
					</div>
				</SidebarProvider>
			</PeriodProvider>
		</RequireAuth>
	);
}
