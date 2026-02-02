"use client";

import { Link, useLocation } from "@tanstack/react-router";
import {
	BugIcon,
	ChevronRightIcon,
	DoorOpenIcon,
	ExternalLinkIcon,
	LayoutDashboardIcon,
	MenuIcon,
	MoonIcon,
	PanelLeftCloseIcon,
	PanelLeftIcon,
	SettingsIcon,
	SunIcon,
	SunMoonIcon,
	UserIcon,
	XIcon,
} from "lucide-react";
import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { PeriodSelector } from "@/components/periods/period-selector";
import { usePeriod } from "@/components/providers/period-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppNavigation } from "@/hooks/use-app-navigation";
import { useGlitchEgg } from "@/hooks/use-glitch-egg";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
	type AppModule,
	adminNavItems,
	appModules,
	getCurrentModule,
	isAdminPath,
	type NavItem,
} from "./nav-config";

// Sidebar collapsed state context
interface SidebarContextType {
	isCollapsed: boolean;
	setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
	toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

function useSidebarContext() {
	const context = useContext(SidebarContext);
	return context;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const toggleSidebar = () => setIsCollapsed((prev) => !prev);

	return (
		<SidebarContext.Provider
			value={{ isCollapsed, setIsCollapsed, toggleSidebar }}
		>
			{children}
		</SidebarContext.Provider>
	);
}

interface DualSidebarProps {
	showPeriodSelector?: boolean;
}

export function DualSidebar({ showPeriodSelector }: DualSidebarProps) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return null; // Mobile uses MobileNavTrigger separately
	}

	return <DesktopSidebar showPeriodSelector={showPeriodSelector} />;
}

interface DesktopSidebarProps {
	showPeriodSelector?: boolean;
}

function DesktopSidebar({ showPeriodSelector }: DesktopSidebarProps) {
	const location = useLocation();
	const pathname = location?.pathname ?? "/";
	const user = useCurrentUser();
	const { canAccessShifts } = useShiftAccess();
	const { handleClick: handleLogoClick } = useGlitchEgg();
	const { modulePaths } = useAppNavigation();
	const sidebarContext = useSidebarContext();
	const isCollapsed = sidebarContext?.isCollapsed ?? false;

	const currentModule = getCurrentModule(pathname);
	const isAdmin = isAdminPath(pathname);

	// Filter modules based on permissions
	const visibleModules = useMemo(() => {
		return appModules.filter((module) => {
			if (module.allowWithShiftAccess && canAccessShifts) {
				return true;
			}
			return checkPermissions(user, module.permissions);
		});
	}, [user, canAccessShifts]);

	// Check if user has any admin permissions
	const hasAnyAdminAccess = useMemo(() => {
		return adminNavItems.some((group) =>
			group.items.some((item) => checkPermissions(user, item.permissions)),
		);
	}, [user]);

	// Get the navigation groups to display
	const navGroups = useMemo(() => {
		if (isAdmin) {
			return adminNavItems;
		}
		return currentModule?.groups ?? [];
	}, [currentModule, isAdmin]);

	const moduleColor = isAdmin
		? "text-red-500"
		: (currentModule?.color ?? "text-blue-500");

	const moduleName = isAdmin ? "Admin" : (currentModule?.name ?? "Dashboard");
	const ModuleIcon = isAdmin
		? SettingsIcon
		: (currentModule?.icon ?? appModules[0].icon);

	return (
		<TooltipProvider delayDuration={0}>
			<div className="flex h-full">
				{/* App Rail - Icon sidebar */}
				<div
					className={cn(
						"flex h-full flex-col items-center border-r bg-sidebar/50 py-3 gap-2 transition-all duration-200",
						isCollapsed ? "w-0 overflow-hidden border-r-0 p-0" : "w-16",
					)}
				>
					{/* Logo */}
					<button
						type="button"
						onClick={handleLogoClick}
						className="mb-2 cursor-pointer px-2"
					>
						<Logo className="h-8 w-8 p-0" />
					</button>

					{/* App modules */}
					<div className="flex flex-col items-center gap-1">
						{visibleModules.map((module) => {
							const isActive = currentModule?.id === module.id && !isAdmin;
							return (
								<RailItem
									key={module.id}
									module={module}
									isActive={isActive}
									savedPath={modulePaths[module.id]}
								/>
							);
						})}

						{/* Admin with separator */}
						{hasAnyAdminAccess && (
							<>
								<div className="w-8 border-t border-sidebar-border my-1" />
								<RailItem
									module={{
										id: "admin",
										name: "Admin",
										description: "System administration",
										icon: SettingsIcon,
										basePath: "/app/users",
										color: "text-red-500",
										permissions: [],
										groups: [],
									}}
									isActive={isAdmin}
									savedPath={modulePaths.admin}
								/>
							</>
						)}
					</div>
				</div>

				{/* Main Sidebar */}
				<div
					className={cn(
						"flex h-full flex-col border-r bg-sidebar transition-all duration-200",
						isCollapsed
							? "w-0 overflow-hidden border-r-0"
							: "min-w-56 w-fit max-w-72",
					)}
				>
					{/* Module header */}
					<div className="flex h-14 items-center gap-2 border-b px-4 whitespace-nowrap">
						<ModuleIcon className={cn("h-5 w-5", moduleColor)} />
						<span className="font-semibold">{moduleName}</span>
					</div>

					{/* Navigation content */}
					<ScrollArea className="flex-1 overflow-y-auto">
						<div className="p-3 min-w-0">
							{/* Period selector for shifts */}
							{showPeriodSelector && currentModule?.id === "shifts" && (
								<div className="mb-3 px-1">
									<div className="text-xs font-medium text-muted-foreground mb-2">
										Period
									</div>
									<PeriodSelectorWrapper />
								</div>
							)}

							{/* Navigation groups */}
							<NavGroups
								groups={navGroups}
								pathname={pathname}
								canAccessShifts={canAccessShifts}
							/>
						</div>
					</ScrollArea>

					{/* User footer */}
					<UserMenu />
				</div>
			</div>
		</TooltipProvider>
	);
}

/**
 * Desktop header trigger component to collapse/expand the sidebar
 */
export function DesktopSidebarTrigger() {
	const isMobile = useIsMobile();
	const sidebarContext = useSidebarContext();

	if (isMobile || !sidebarContext) return null;

	const { isCollapsed, toggleSidebar } = sidebarContext;

	return (
		<Button
			variant="ghost"
			size="icon"
			className="hidden md:flex"
			onClick={toggleSidebar}
		>
			{isCollapsed ? (
				<PanelLeftIcon className="h-5 w-5" />
			) : (
				<PanelLeftCloseIcon className="h-5 w-5" />
			)}
			<span className="sr-only">
				{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
			</span>
		</Button>
	);
}

interface RailItemProps {
	module: AppModule;
	isActive: boolean;
	savedPath?: string;
}

function RailItem({ module, isActive, savedPath }: RailItemProps) {
	const targetPath = savedPath ?? module.basePath;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link
					to={targetPath}
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-lg transition-all",
						"hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
						isActive &&
							"bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
						!isActive &&
							"text-sidebar-foreground/60 hover:text-sidebar-foreground",
					)}
				>
					<module.icon className={cn("h-5 w-5", isActive && module.color)} />
				</Link>
			</TooltipTrigger>
			<TooltipContent side="right" sideOffset={8}>
				<div className="font-medium">{module.name}</div>
				<div className="text-xs text-muted-foreground">
					{module.description}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

interface MobileSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	showPeriodSelector?: boolean;
}

function MobileSidebar({
	open,
	onOpenChange,
	showPeriodSelector,
}: MobileSidebarProps) {
	const location = useLocation();
	const pathname = location?.pathname ?? "/";
	const { canAccessShifts } = useShiftAccess();
	const { handleClick: handleLogoClick } = useGlitchEgg();

	const currentModule = getCurrentModule(pathname);
	const isAdmin = isAdminPath(pathname);

	// Get the navigation groups to display
	const navGroups = useMemo(() => {
		if (isAdmin) {
			return adminNavItems;
		}
		return currentModule?.groups ?? [];
	}, [currentModule, isAdmin]);

	const moduleColor = isAdmin
		? "text-red-500"
		: (currentModule?.color ?? "text-blue-500");

	const moduleName = isAdmin ? "Admin" : (currentModule?.name ?? "Dashboard");
	const ModuleIcon = isAdmin
		? SettingsIcon
		: (currentModule?.icon ?? appModules[0].icon);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="left"
				showCloseButton={false}
				className="w-fit min-w-80 max-w-[85vw] p-0"
			>
				<SheetTitle className="sr-only">Navigation Menu</SheetTitle>
				<div className="flex h-full flex-col">
					{/* Header with logo and close */}
					<div className="flex h-14 items-center justify-between border-b px-4">
						<button
							type="button"
							onClick={handleLogoClick}
							className="cursor-pointer"
						>
							<Logo className="h-8" />
						</button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onOpenChange(false)}
						>
							<XIcon className="h-4 w-4" />
						</Button>
					</div>

					<ScrollArea className="flex-1 overflow-y-auto">
						{/* Current module header */}
						<div className="flex items-center gap-2 px-4 py-3 border-b">
							<ModuleIcon className={cn("h-5 w-5", moduleColor)} />
							<span className="font-semibold">{moduleName}</span>
						</div>

						{/* Period selector for shifts */}
						{showPeriodSelector && currentModule?.id === "shifts" && (
							<div className="p-4 border-b">
								<div className="text-xs font-medium text-muted-foreground mb-2">
									Period
								</div>
								<PeriodSelectorWrapper />
							</div>
						)}

						{/* Navigation items */}
						<div className="p-3">
							<NavGroups
								groups={navGroups}
								pathname={pathname}
								canAccessShifts={canAccessShifts}
								onNavigate={() => onOpenChange(false)}
							/>
						</div>
					</ScrollArea>
				</div>
			</SheetContent>
		</Sheet>
	);
}

interface NavGroupsProps {
	groups: typeof adminNavItems;
	pathname: string;
	canAccessShifts: boolean;
	onNavigate?: () => void;
}

function NavGroups({
	groups,
	pathname,
	canAccessShifts,
	onNavigate,
}: NavGroupsProps) {
	const user = useCurrentUser();

	const canViewItem = (item: NavItem) => {
		if (item.allowWithShiftAccess && canAccessShifts) {
			return true;
		}
		return checkPermissions(user, item.permissions);
	};

	// Collect all visible URLs for active state calculation
	const allVisibleUrls = useMemo(() => {
		return groups.flatMap((group) =>
			group.items.filter(canViewItem).map((item) => item.url),
		);
	}, [groups, user, canAccessShifts]);

	const isPathActive = (itemUrl: string) => {
		const normalize = (p: string) => p.replace(/\/+$/, "");
		const nPath = normalize(pathname);
		const nItem = normalize(itemUrl);

		const matches = nPath === nItem || nPath.startsWith(`${nItem}/`);
		if (!matches) return false;

		const longestMatch = allVisibleUrls
			.map(normalize)
			.filter((url) => nPath === url || nPath.startsWith(`${url}/`))
			.sort((a, b) => b.length - a.length)[0];

		return nItem === longestMatch;
	};

	return (
		<div className="space-y-4">
			{groups.map((group) => {
				const visibleItems = group.items.filter(canViewItem);
				if (visibleItems.length === 0) return null;

				return (
					<div key={group.name || "main"}>
						{group.name && (
							<div className="px-2 mb-1 text-xs font-medium text-muted-foreground">
								{group.name}
							</div>
						)}
						<div className="space-y-0.5">
							{visibleItems.map((item) => {
								const isActive = isPathActive(item.url);
								return (
									<NavItemLink
										key={item.url}
										item={item}
										isActive={isActive}
										onClick={onNavigate}
									/>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}

interface NavItemLinkProps {
	item: NavItem;
	isActive: boolean;
	onClick?: () => void;
}

function NavItemLink({ item, isActive, onClick }: NavItemLinkProps) {
	const baseClasses = cn(
		"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
		isActive
			? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
			: "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
	);

	if (item.external) {
		return (
			<a
				href={item.url}
				target="_blank"
				rel="noopener noreferrer"
				className={baseClasses}
				onClick={onClick}
			>
				<item.icon className="h-4 w-4" />
				<span className="flex-1">{item.title}</span>
				<ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
			</a>
		);
	}

	return (
		<Link to={item.url} className={baseClasses} onClick={onClick}>
			<item.icon className="h-4 w-4" />
			<span className="flex-1">{item.title}</span>
		</Link>
	);
}

function UserMenu() {
	const user = useCurrentUser();
	const { logout } = useAuth();
	const { setTheme } = useTheme();

	return (
		<div className="border-t p-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
					>
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
							{(user?.name || user?.email || "U").charAt(0).toUpperCase()}
						</div>
						<div className="flex-1 min-w-0 text-left">
							<div className="font-medium truncate">
								{user?.name ?? user?.email ?? "Account"}
							</div>
							<div className="text-xs text-muted-foreground truncate">
								{user?.email}
							</div>
						</div>
						<ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>HUMS v{__APP_VERSION__}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<Link to="/app/me">
						<DropdownMenuItem>
							<UserIcon className="h-4 w-4" />
							My Profile
						</DropdownMenuItem>
					</Link>
					<a href="/overview/" target="_blank" rel="noopener noreferrer">
						<DropdownMenuItem>
							<LayoutDashboardIcon className="h-4 w-4" />
							Space Overview
						</DropdownMenuItem>
					</a>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Theme</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setTheme("light")}>
						<SunIcon className="h-4 w-4" />
						Light
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setTheme("dark")}>
						<MoonIcon className="h-4 w-4" />
						Dark
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setTheme("system")}>
						<SunMoonIcon className="h-4 w-4" />
						System
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<a
						href="https://github.com/ECEHive/hums/issues"
						target="_blank"
						rel="noopener noreferrer"
					>
						<DropdownMenuItem>
							<BugIcon className="h-4 w-4" />
							Report Issue
						</DropdownMenuItem>
					</a>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => logout()}>
						<DoorOpenIcon className="h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

/**
 * Wrapper for PeriodSelector to handle the period context
 */
function PeriodSelectorWrapper() {
	const periodContext = usePeriod();

	if (!periodContext) {
		return null;
	}

	const { period, setPeriod } = periodContext;
	return (
		<PeriodSelector
			selectedPeriodId={period}
			onPeriodChange={(periodId) => setPeriod(periodId)}
		/>
	);
}

/**
 * Mobile header trigger component for use in the main layout
 */
export function MobileNavTrigger({
	showPeriodSelector,
}: {
	showPeriodSelector?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const isMobile = useIsMobile();

	if (!isMobile) return null;

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className="md:hidden"
				onClick={() => setOpen(true)}
			>
				<MenuIcon className="h-5 w-5" />
			</Button>
			<MobileSidebar
				open={open}
				onOpenChange={setOpen}
				showPeriodSelector={showPeriodSelector}
			/>
		</>
	);
}

/**
 * Mobile bottom tab bar for app switching
 * Displays icons for each app module in a fixed bottom bar
 */
export function MobileTabBar() {
	const location = useLocation();
	const pathname = location?.pathname ?? "/";
	const user = useCurrentUser();
	const { canAccessShifts } = useShiftAccess();
	const { modulePaths } = useAppNavigation();
	const isMobile = useIsMobile();
	const { logout } = useAuth();
	const { setTheme } = useTheme();

	const currentModule = getCurrentModule(pathname);
	const isAdmin = isAdminPath(pathname);

	// Filter modules based on permissions
	const visibleModules = useMemo(() => {
		return appModules.filter((module) => {
			if (module.allowWithShiftAccess && canAccessShifts) {
				return true;
			}
			return checkPermissions(user, module.permissions);
		});
	}, [user, canAccessShifts]);

	// Check if user has any admin permissions
	const hasAnyAdminAccess = useMemo(() => {
		return adminNavItems.some((group) =>
			group.items.some((item) => checkPermissions(user, item.permissions)),
		);
	}, [user]);

	if (!isMobile) return null;

	// All tabs including admin if user has access
	const tabs = [
		...visibleModules.map((module) => ({
			id: module.id,
			name: module.name,
			icon: module.icon,
			path: modulePaths[module.id] ?? module.basePath,
			color: module.color,
			isActive: currentModule?.id === module.id && !isAdmin,
		})),
		...(hasAnyAdminAccess
			? [
					{
						id: "admin",
						name: "Admin",
						icon: SettingsIcon,
						path: modulePaths.admin ?? "/app/users",
						color: "text-red-500",
						isActive: isAdmin,
					},
				]
			: []),
	];

	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden safe-area-inset-bottom">
			<div className="flex h-16 items-center justify-around px-2">
				{tabs.map((tab) => (
					<Link
						key={tab.id}
						to={tab.path}
						className={cn(
							"flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
							tab.isActive
								? tab.color
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<tab.icon className="h-5 w-5" />
						<span className="text-[10px] font-medium">{tab.name}</span>
					</Link>
				))}
				{/* User profile tab with dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors text-muted-foreground hover:text-foreground"
						>
							<div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
								{(user?.name || user?.email || "U").charAt(0).toUpperCase()}
							</div>
							<span className="text-[10px] font-medium">Profile</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" side="top" className="w-56 mb-2">
						<DropdownMenuLabel>
							<div className="flex flex-col">
								<span>{user?.name ?? "Account"}</span>
								<span className="text-xs font-normal text-muted-foreground">
									{user?.email}
								</span>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<Link to="/app/me">
							<DropdownMenuItem>
								<UserIcon className="h-4 w-4" />
								My Profile
							</DropdownMenuItem>
						</Link>
						<a href="/overview/" target="_blank" rel="noopener noreferrer">
							<DropdownMenuItem>
								<LayoutDashboardIcon className="h-4 w-4" />
								Space Overview
							</DropdownMenuItem>
						</a>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Theme</DropdownMenuLabel>
						<DropdownMenuItem onSelect={() => setTheme("light")}>
							<SunIcon className="h-4 w-4" />
							Light
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setTheme("dark")}>
							<MoonIcon className="h-4 w-4" />
							Dark
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setTheme("system")}>
							<SunMoonIcon className="h-4 w-4" />
							System
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<a
							href="https://github.com/ECEHive/hums/issues"
							target="_blank"
							rel="noopener noreferrer"
						>
							<DropdownMenuItem>
								<BugIcon className="h-4 w-4" />
								Report Issue
							</DropdownMenuItem>
						</a>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => logout()}>
							<DoorOpenIcon className="h-4 w-4" />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</nav>
	);
}
