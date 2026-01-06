import { Outlet } from "@tanstack/react-router";
import type React from "react";
import { RequireAuth } from "@/auth/AuthProvider";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { usePageTitle } from "@/hooks/use-page-title";

interface AppShellProps {
	/**
	 * The sidebar component to render
	 */
	sidebar: React.ReactNode;
	/**
	 * Optional banner components to show above the header
	 */
	banners?: React.ReactNode;
	/**
	 * Optional wrapper components (e.g., PeriodProvider)
	 * Function receives children and should return wrapped JSX
	 */
	wrapper?: (children: React.ReactNode) => React.ReactNode;
}

/**
 * Base application shell that provides consistent layout structure
 * with sidebar, header, breadcrumbs, and content area.
 *
 * @example
 * ```tsx
 * <AppShell
 *   sidebar={<AppSidebar />}
 *   banners={<><ImpersonationBanner /><AgreementsBanner /></>}
 * />
 * ```
 */
export function AppShell({ sidebar, banners, wrapper }: AppShellProps) {
	// Automatically update page title based on current route
	usePageTitle();

	const content = (
		<RequireAuth>
			<SidebarProvider>
				{sidebar}
				<SidebarInset>
					<header className="flex h-16 shrink-0 items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<DynamicBreadcrumbs />
					</header>
					{banners && <div className="px-4 md:px-6">{banners}</div>}
					<Outlet />
				</SidebarInset>
			</SidebarProvider>
		</RequireAuth>
	);

	// If a wrapper is provided, use it to wrap the content
	return wrapper ? wrapper(content) : content;
}
