import { Link, useLocation } from "@tanstack/react-router";
import {
	BanIcon,
	BugIcon,
	CalendarClock,
	CalendarIcon,
	CameraIcon,
	ChevronRightIcon,
	ChevronsDownIcon,
	ChevronsUpIcon,
	ChevronUpIcon,
	ClipboardListIcon,
	ClockIcon,
	DoorOpenIcon,
	ExternalLink,
	FileClockIcon,
	FileTextIcon,
	HomeIcon,
	KeyIcon,
	LaptopMinimalCheckIcon,
	LayoutDashboardIcon,
	MoonIcon,
	ScrollTextIcon,
	SettingsIcon,
	ShieldIcon,
	SunIcon,
	SunMoonIcon,
	TicketIcon,
	User2Icon,
	UserIcon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { useTheme } from "@/components/providers/theme-provider";
import { Logo } from "@/components/shared/logo";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useGlitchEgg } from "@/hooks/use-glitch-egg";
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions } from "@/lib/permissions";
import { permissions as agreementsPagePermissions } from "@/routes/app/_app/agreements";
import { permissions as apiTokensPagePermissions } from "@/routes/app/_app/api-tokens";
import { permissions as auditLogsPagePermissions } from "@/routes/app/_app/audit-logs";
import { permissions as configurationPagePermissions } from "@/routes/app/_app/configuration";
import { permissions as devicesPagePermissions } from "@/routes/app/_app/devices";
import { permissions as appIndexPagePermissions } from "@/routes/app/_app/index";
import { permissions as reportsPagePermissions } from "@/routes/app/_app/reports";
import { permissions as rolesPagePermissions } from "@/routes/app/_app/roles";
import { permissions as securityPagePermissions } from "@/routes/app/_app/security";
import { permissions as sessionsPagePermissions } from "@/routes/app/_app/sessions";
import { permissions as suspensionsPagePermissions } from "@/routes/app/_app/suspensions";
import { permissions as usersPagePermissions } from "@/routes/app/_app/users";

// Sidebar menu items, grouped by section
type AppSidebarItem = {
	title: string;
	url: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	permissions: string[] | Record<string, string[]>;
	allowWithShiftAccess?: boolean;
	hasChildren?: boolean;
};

type AppSidebarGroup = {
	name?: string;
	items: AppSidebarItem[];
};

export const items: AppSidebarGroup[] = [
	{
		items: [
			{
				title: "Home",
				url: "/app",
				icon: HomeIcon,
				permissions: appIndexPagePermissions,
			},
			{
				title: "Shifts",
				url: "/app/shifts",
				icon: CalendarIcon,
				permissions: [],
				allowWithShiftAccess: true,
				hasChildren: true,
			},
			{
				title: "Inventory",
				url: "/app/inventory",
				icon: LaptopMinimalCheckIcon,
				permissions: [], // Available to all authenticated users
				hasChildren: true,
			},
			{
				title: "Tickets",
				url: "/app/tickets",
				icon: TicketIcon,
				permissions: [], // Available to all authenticated users
				hasChildren: true,
			},
			{
				title: "My Profile",
				url: "/app/me",
				icon: User2Icon,
				permissions: [], // Available to all authenticated users
				hasChildren: true,
			},
		],
	},
	{
		name: "Admin",
		items: [
			{
				title: "Roles",
				url: "/app/roles",
				icon: ShieldIcon,
				permissions: rolesPagePermissions,
			},
			{
				title: "Users",
				url: "/app/users",
				icon: UserIcon,
				permissions: usersPagePermissions,
			},
			{
				title: "Suspensions",
				url: "/app/suspensions",
				icon: BanIcon,
				permissions: suspensionsPagePermissions,
			},
			{
				title: "Agreements",
				url: "/app/agreements",
				icon: FileTextIcon,
				permissions: agreementsPagePermissions,
			},
			{
				title: "Devices",
				url: "/app/devices",
				icon: LaptopMinimalCheckIcon,
				permissions: devicesPagePermissions,
			},
			{
				title: "API Tokens",
				url: "/app/api-tokens",
				icon: KeyIcon,
				permissions: apiTokensPagePermissions,
			},
			{
				title: "Audit Logs",
				url: "/app/audit-logs",
				icon: ScrollTextIcon,
				permissions: auditLogsPagePermissions,
			},
			{
				title: "Sessions",
				url: "/app/sessions",
				icon: FileClockIcon,
				permissions: sessionsPagePermissions,
			},
			{
				title: "Security Snapshots",
				url: "/app/security",
				icon: CameraIcon,
				permissions: securityPagePermissions,
			},
			{
				title: "Reports",
				url: "/app/reports",
				icon: ClipboardListIcon,
				permissions: reportsPagePermissions,
			},
			{
				title: "Configuration",
				url: "/app/configuration",
				icon: SettingsIcon,
				permissions: configurationPagePermissions,
			},
		],
	},
];

export function AppSidebar() {
	const user = useCurrentUser();
	const { logout } = useAuth();
	const { setTheme } = useTheme();
	const location = useLocation();
	const pathname = location?.pathname ?? "/";
	const { canAccessShifts } = useShiftAccess();
	const { handleClick: handleLogoClick } = useGlitchEgg();

	const canViewItem = (item: AppSidebarItem) => {
		// If shift access is required, only check canAccessShifts
		if (item.allowWithShiftAccess) {
			return canAccessShifts;
		}
		// Otherwise, check regular permissions
		return checkPermissions(user, item.permissions);
	};

	// Collect all visible items across all groups to find the best match
	const allVisibleItems = items.flatMap((group) =>
		group.items.filter((item) => canViewItem(item)),
	);

	// Also include nested routes under "My Profile" for proper highlighting
	const nestedProfileUrls = [
		"/app/me/sessions",
		...(canAccessShifts
			? ["/app/shifts/my-shifts", "/app/shifts/attendance"]
			: []),
	];

	const isPathActive = (itemUrl: string) => {
		// Normalize trailing slashes for comparison
		const normalize = (p: string) => p.replace(/\/+$/, "");
		const nPath = normalize(pathname);
		const nItem = normalize(itemUrl);

		// Check if this item matches the current path
		const matches = nPath === nItem || nPath.startsWith(`${nItem}/`);
		if (!matches) return false;

		// Combine main items and nested profile URLs for matching
		const allUrls = [
			...allVisibleItems.map((item) => normalize(item.url)),
			...nestedProfileUrls.map(normalize),
		];

		// Find the longest matching URL (most specific)
		const longestMatch = allUrls
			.filter((url) => nPath === url || nPath.startsWith(`${url}/`))
			.sort((a, b) => b.length - a.length)[0];

		// Only active if this is the longest (most specific) match
		return nItem === longestMatch;
	};

	return (
		<Sidebar variant="floating" data-sidebar-id="app">
			<SidebarHeader onClick={handleLogoClick}>
				<Logo className="h-8 p-1" />
			</SidebarHeader>
			<SidebarContent>
				{items.map((group) => {
					const visibleItems = group.items.filter((item) => canViewItem(item));
					if (visibleItems.length === 0) return null;
					return (
						<SidebarGroup key={group.name || "group"}>
							{group.name && (
								<SidebarGroupLabel>{group.name}</SidebarGroupLabel>
							)}
							<SidebarGroupContent>
								<SidebarMenu>
									{visibleItems.map((item) => {
										// Special handling for "My Profile" - make it collapsible with nested items
										if (item.title === "My Profile") {
											// Auto-expand when on My Profile or any sub-page
											const isProfileSection = pathname.startsWith("/app/me");

											return (
												<Collapsible
													key={item.title}
													className="group/collapsible"
													open={isProfileSection}
												>
													<SidebarMenuItem>
														<CollapsibleTrigger asChild>
															<SidebarMenuButton
																asChild
																isActive={isPathActive(item.url)}
																tooltip={item.title}
															>
																<Link to={item.url} className="w-full">
																	<item.icon className="h-4 w-4" />
																	<span className="flex-1">{item.title}</span>
																	{isProfileSection ? (
																		<ChevronsDownIcon className="ml-auto h-4 w-4" />
																	) : (
																		<ChevronsUpIcon className="ml-auto h-4 w-4" />
																	)}
																</Link>
															</SidebarMenuButton>
														</CollapsibleTrigger>
														<CollapsibleContent>
															<SidebarMenuSub>
																{/* My Sessions - always visible */}
																<SidebarMenuSubItem>
																	<SidebarMenuSubButton
																		asChild
																		isActive={isPathActive("/app/me/sessions")}
																	>
																		<Link to="/app/me/sessions">
																			<ClockIcon className="h-4 w-4" />
																			<span>My Sessions</span>
																		</Link>
																	</SidebarMenuSubButton>
																</SidebarMenuSubItem>

																{/* My Shifts - only if canAccessShifts */}
																{canAccessShifts && (
																	<SidebarMenuSubItem>
																		<SidebarMenuSubButton
																			asChild
																			isActive={isPathActive(
																				"/app/shifts/my-shifts",
																			)}
																		>
																			<Link to="/app/shifts/my-shifts">
																				<CalendarIcon className="h-4 w-4" />
																				<span>My Shifts</span>
																				<ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
																			</Link>
																		</SidebarMenuSubButton>
																	</SidebarMenuSubItem>
																)}

																{/* My Attendance - only if canAccessShifts */}
																{canAccessShifts && (
																	<SidebarMenuSubItem>
																		<SidebarMenuSubButton
																			asChild
																			isActive={isPathActive(
																				"/app/shifts/attendance",
																			)}
																		>
																			<Link to="/app/shifts/attendance">
																				<CalendarClock className="h-4 w-4" />
																				<span>My Attendance</span>
																				<ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
																			</Link>
																		</SidebarMenuSubButton>
																	</SidebarMenuSubItem>
																)}
															</SidebarMenuSub>
														</CollapsibleContent>
													</SidebarMenuItem>
												</Collapsible>
											);
										}

										// Regular menu items
										return (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton
													asChild
													isActive={isPathActive(item.url)}
												>
													<Link
														to={item.url}
														className="flex w-full items-center gap-3"
													>
														<item.icon className="h-4 w-4" />
														<span className="flex-1">{item.title}</span>
														{item.hasChildren && (
															<ChevronRightIcon className="ml-2 h-4 w-4 text-muted-foreground" />
														)}
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					);
				})}
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<User2Icon /> {user?.name ?? user?.email ?? "Account"}
									<ChevronUpIcon className="ml-auto" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="top"
								className="w-[--radix-popper-anchor-width]"
							>
								<DropdownMenuLabel>HUMS v{__APP_VERSION__}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<a href="/overview/" target="_blank" rel="noopener noreferrer">
									<DropdownMenuItem>
										<LayoutDashboardIcon />
										Open Space Overview
									</DropdownMenuItem>
								</a>
								<DropdownMenuSeparator />
								<DropdownMenuLabel>Theme</DropdownMenuLabel>
								<DropdownMenuItem onSelect={() => setTheme("light")}>
									<SunIcon />
									Light
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setTheme("dark")}>
									<MoonIcon />
									Dark
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setTheme("system")}>
									<SunMoonIcon />
									System
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<a
									href="https://github.com/ECEHive/hums/issues"
									target="_blank"
									rel="noopener noreferrer"
								>
									<DropdownMenuItem>
										<BugIcon />
										Report an Issue
									</DropdownMenuItem>
								</a>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => logout()}>
									<DoorOpenIcon />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
