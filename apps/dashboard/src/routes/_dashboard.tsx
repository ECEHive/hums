import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/navigation/dashboard-sidebar";
import { DashboardHeader } from "@/components/navigation/dashboard-header";
import {
	SidebarInset,
	SidebarProvider,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_dashboard")({
	component: DashboardLayout,
});

function DashboardLayout() {
	return (
		<SidebarProvider>
			<DashboardSidebar />
			<SidebarInset>
				<DashboardHeader />
				<main className="flex-1 p-4 md:p-6">
					<Outlet />
					<footer className="mt-12 pt-6 border-t border-border">
						<p className="text-xs text-muted-foreground text-center">
							Powered by HUMS
						</p>
					</footer>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
