import { Outlet } from "@tanstack/react-router";
import type React from "react";
import { RequireAuth } from "@/auth/AuthProvider";
import {
	DualSidebar,
	MobileNavTrigger,
	MobileTabBar,
} from "@/components/navigation/dual-sidebar";
import { DynamicBreadcrumbs } from "@/components/navigation/dynamic-breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";

interface AppShellProps {
	/**
	 * Optional banner components to show above the header
	 */
	banners?: React.ReactNode;
	/**
	 * Optional wrapper components (e.g., PeriodProvider)
	 * Function receives children and should return wrapped JSX
	 */
	wrapper?: (children: React.ReactNode) => React.ReactNode;
	/**
	 * Whether to show the period selector in the sidebar (for shifts module)
	 */
	showPeriodSelector?: boolean;
}

/**
 * Base application shell that provides consistent layout structure
 * with dual sidebar navigation, header, breadcrumbs, and content area.
 *
 * Features a two-panel sidebar:
 * - Left icon rail for quick app switching
 * - Main sidebar with contextual navigation
 *
 * @example
 * ```tsx
 * <AppShell
 *   banners={<><ImpersonationBanner /><AgreementsBanner /></>}
 * />
 * ```
 */
export function AppShell({
	banners,
	wrapper,
	showPeriodSelector,
}: AppShellProps) {
	usePageTitle();
	const isMobile = useIsMobile();

	const content = (
		<RequireAuth>
			<TooltipProvider delayDuration={0}>
				<div className="flex h-svh w-full bg-background">
					{/* Desktop sidebar */}
					{!isMobile && <DualSidebar showPeriodSelector={showPeriodSelector} />}

					{/* Main content area */}
					<div className="flex flex-1 flex-col min-w-0">
						{/* Header */}
						<header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
							{isMobile && (
								<MobileNavTrigger showPeriodSelector={showPeriodSelector} />
							)}
							{isMobile && <Separator orientation="vertical" className="h-6" />}
							<DynamicBreadcrumbs />
						</header>

						{/* Banners */}
						{banners && <div className="px-4 py-2 md:px-6">{banners}</div>}

						{/* Page content - add bottom padding on mobile for tab bar */}
						<main className={cn("flex-1 overflow-auto", isMobile && "pb-16")}>
							<Outlet />
						</main>
					</div>

					{/* Mobile tab bar */}
					<MobileTabBar />
				</div>
			</TooltipProvider>
		</RequireAuth>
	);

	return wrapper ? wrapper(content) : content;
}
