import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/auth/AuthProvider";
import { AgreementsBanner } from "@/components/banners/agreements-banner";
import { ImpersonationBanner } from "@/components/banners/impersonate-banner";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<RequireAuth>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<ImpersonationBanner />
					<AgreementsBanner />
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
		</RequireAuth>
	);
}
