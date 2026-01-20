import { Link, useLocation } from "@tanstack/react-router";
import {
	BugIcon,
	CalendarCheckIcon,
	CalendarIcon,
	CalendarXIcon,
	ChevronLeft,
	ChevronUpIcon,
	ClipboardListIcon,
	ClockIcon,
	DoorOpenIcon,
	HomeIcon,
	LayoutDashboardIcon,
	ListIcon,
	MoonIcon,
	NotebookTextIcon,
	ShieldCheckIcon,
	SunIcon,
	SunMoonIcon,
	User2Icon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { PeriodSelector } from "@/components/periods/period-selector";
import { usePeriod } from "@/components/providers/period-provider";
import { useTheme } from "@/components/providers/theme-provider"; // Import useTheme from theme-provider
import { Logo } from "@/components/shared/logo";
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
} from "@/components/ui/sidebar";
import { useGlitchEgg } from "@/hooks/use-glitch-egg";
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions } from "@/lib/permissions";
import { permissions as attendancePagePermissions } from "@/routes/app/shifts/attendance";
import { permissions as shiftsIndexPagePermissions } from "@/routes/app/shifts/index";
import { permissions as manageUsersPagePermissions } from "@/routes/app/shifts/manage-users.index";
import { permissions as myShiftsPagePermissions } from "@/routes/app/shifts/my-shifts";
import { permissions as periodDetailsPagePermissions } from "@/routes/app/shifts/period-details";
import { permissions as periodExceptionsPagePermissions } from "@/routes/app/shifts/period-exceptions";
import { permissions as reportsPagePermissions } from "@/routes/app/shifts/reports";
import { permissions as schedulingPagePermissions } from "@/routes/app/shifts/scheduling";
import { permissions as shiftSchedulesPagePermissions } from "@/routes/app/shifts/shift-schedules";
import { permissions as shiftTypesPagePermissions } from "@/routes/app/shifts/shift-types";

// Sidebar menu items, grouped by section
export const items = [
	{
		name: "Shifts",
		items: [
			{
				title: "Home",
				url: "/app/shifts",
				icon: HomeIcon,
				permissions: shiftsIndexPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "Scheduling",
				url: "/app/shifts/scheduling",
				icon: CalendarIcon,
				permissions: schedulingPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "My Shifts",
				url: "/app/shifts/my-shifts",
				icon: ClipboardListIcon,
				permissions: myShiftsPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "Attendance",
				url: "/app/shifts/attendance",
				icon: CalendarCheckIcon,
				permissions: attendancePagePermissions,
				allowWithShiftAccess: true,
			},
		],
	},
	{
		name: "Admin",
		items: [
			{
				title: "Period Details",
				url: "/app/shifts/period-details",
				icon: CalendarIcon,
				permissions: periodDetailsPagePermissions,
			},
			{
				title: "Period Exceptions",
				url: "/app/shifts/period-exceptions",
				icon: CalendarXIcon,
				permissions: periodExceptionsPagePermissions,
			},
			{
				title: "Shift Types",
				url: "/app/shifts/shift-types",
				icon: ListIcon,
				permissions: shiftTypesPagePermissions,
			},
			{
				title: "Shift Schedules",
				url: "/app/shifts/shift-schedules",
				icon: ClockIcon,
				permissions: shiftSchedulesPagePermissions,
			},
			{
				title: "Manage Users",
				url: "/app/shifts/manage-users",
				icon: ShieldCheckIcon,
				permissions: manageUsersPagePermissions,
			},
			{
				title: "Reports",
				url: "/app/shifts/reports",
				icon: NotebookTextIcon,
				permissions: reportsPagePermissions,
			},
		],
	},
];

export function ShiftsSidebar() {
	const user = useCurrentUser();
	const { logout } = useAuth();
	const { setTheme } = useTheme();
	const location = useLocation();
	const { handleClick: handleLogoClick } = useGlitchEgg();
	const pathname = location?.pathname ?? "/";
	const { canAccessShifts } = useShiftAccess();

	const canViewItem = (item: (typeof items)[number]["items"][number]) => {
		if (checkPermissions(user, item.permissions)) {
			return true;
		}
		if ("allowWithShiftAccess" in item && item.allowWithShiftAccess) {
			return canAccessShifts;
		}
		return false;
	};

	// Collect all visible items across all groups to find the best match
	const allVisibleItems = items.flatMap((group) =>
		group.items.filter((item) => canViewItem(item)),
	);

	const isPathActive = (itemUrl: string) => {
		// Normalize trailing slashes for comparison
		const normalize = (p: string) => p.replace(/\/+$/, "");
		const nPath = normalize(pathname);
		const nItem = normalize(itemUrl);

		// Check if this item matches the current path
		const matches = nPath === nItem || nPath.startsWith(`${nItem}/`);
		if (!matches) return false;

		// Find the longest matching item URL (most specific)
		const longestMatch = allVisibleItems
			.map((item) => normalize(item.url))
			.filter((url) => nPath === url || nPath.startsWith(`${url}/`))
			.sort((a, b) => b.length - a.length)[0];

		// Only active if this is the longest (most specific) match
		return nItem === longestMatch;
	};

	const { period, setPeriod } = usePeriod();

	return (
		<Sidebar variant="floating" data-sidebar-id="shifts">
			<SidebarHeader onClick={handleLogoClick}>
				<Logo className="h-8 p-1" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={isPathActive("/app")}>
									<Link to="/app">
										<ChevronLeft />
										<span>Dashboard</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<PeriodSelector
									selectedPeriodId={period}
									onPeriodChange={(periodId) => setPeriod(periodId)}
								/>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
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
									{visibleItems.map((item) => (
										<SidebarMenuItem key={item.title}>
											<SidebarMenuButton
												asChild
												isActive={isPathActive(item.url)}
											>
												<Link to={item.url}>
													<item.icon />
													<span>{item.title}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
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
