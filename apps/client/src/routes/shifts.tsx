import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { ShiftsSidebar } from "@/components/navigation/shifts-sidebar";
import { PeriodProvider } from "@/components/providers/period-provider";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/shifts")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<RequireAuth>
			<PeriodProvider>
				<SidebarProvider>
					<ShiftsSidebar />
					<SidebarInset>
						<ImpersonationBanner />
						<header className="flex h-16 shrink-0 items-center gap-2 px-4">
							<SidebarTrigger className="-ml-1" />
							<Separator
								orientation="vertical"
								className="mr-2 data-[orientation=vertical]:h-4"
							/>
							<DynamicBreadcrumbs />
						</header>
						<Outlet />
					</SidebarInset>
				</SidebarProvider>
			</PeriodProvider>
		</RequireAuth>
	);
}
