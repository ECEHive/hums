import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { AppSidebar } from "@/components/app-sidebar";
import { SimulationBanner } from "@/components/simulation-banner";
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
					<SimulationBanner />
					<div className="flex flex-row p-4 w-full border-b border-border">
						<SidebarTrigger />
					</div>
					<Outlet />
				</div>
			</SidebarProvider>
		</RequireAuth>
	);
}
