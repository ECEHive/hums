import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OverviewHeader } from "@/components/navigation/overview-header";
import { OverviewSidebar } from "@/components/navigation/overview-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_overview")({
	component: OverviewLayout,
});

function OverviewLayout() {
	return (
		<SidebarProvider>
			<OverviewSidebar />
			<SidebarInset>
				<OverviewHeader />
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
