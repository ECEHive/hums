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
	ListIcon,
	MoonIcon,
	NotebookTextIcon,
	ShieldCheckIcon,
	SunIcon,
	SunMoonIcon,
	User2Icon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { useTheme } from "@/components/providers/theme-provider"; // Import useTheme from theme-provider
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
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions } from "@/lib/permissions";
import { permissions as attendancePagePermissions } from "@/routes/shifts/attendance";
import { permissions as shiftsIndexPagePermissions } from "@/routes/shifts/index";
import { permissions as manageUsersPagePermissions } from "@/routes/shifts/manage-users";
import { permissions as myShiftsPagePermissions } from "@/routes/shifts/my-shifts";
import { permissions as periodDetailsPagePermissions } from "@/routes/shifts/period-details";
import { permissions as periodExceptionsPagePermissions } from "@/routes/shifts/period-exceptions";
import { permissions as reportsPagePermissions } from "@/routes/shifts/reports";
import { permissions as schedulingPagePermissions } from "@/routes/shifts/scheduling";
import { permissions as shiftSchedulesPagePermissions } from "@/routes/shifts/shift-schedules";
import { permissions as shiftTypesPagePermissions } from "@/routes/shifts/shift-types";
import { Logo } from "@/components/shared/logo";
import { usePeriod } from "@/components/providers/period-provider";
import { PeriodSelector } from "@/components/periods/period-selector";

// Sidebar menu items, grouped by section
export const items = [
	{
		name: "Shifts",
		items: [
			{
				title: "Home",
				url: "/shifts",
				icon: HomeIcon,
				permissions: shiftsIndexPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "Scheduling",
				url: "/shifts/scheduling",
				icon: CalendarIcon,
				permissions: schedulingPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "My Shifts",
				url: "/shifts/my-shifts",
				icon: ClipboardListIcon,
				permissions: myShiftsPagePermissions,
				allowWithShiftAccess: true,
			},
			{
				title: "Attendance",
				url: "/shifts/attendance",
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
				url: "/shifts/period-details",
				icon: CalendarIcon,
				permissions: periodDetailsPagePermissions,
			},
			{
				title: "Period Exceptions",
				url: "/shifts/period-exceptions",
				icon: CalendarXIcon,
				permissions: periodExceptionsPagePermissions,
			},
			{
				title: "Shift Types",
				url: "/shifts/shift-types",
				icon: ListIcon,
				permissions: shiftTypesPagePermissions,
			},
			{
				title: "Shift Schedules",
				url: "/shifts/shift-schedules",
				icon: ClockIcon,
				permissions: shiftSchedulesPagePermissions,
			},
			{
				title: "Manage Users",
				url: "/shifts/manage-users",
				icon: ShieldCheckIcon,
				permissions: manageUsersPagePermissions,
			},
			{
				title: "Reports",
				url: "/shifts/reports",
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
	const pathname = location?.pathname ?? "/";
	const { canAccessShifts } = useShiftAccess();

	const canViewItem = (item: (typeof items)[number]["items"][number]) => {
		if (checkPermissions(user, item.permissions)) {
			return true;
		}
		if (item.allowWithShiftAccess) {
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
		<Sidebar>
			<SidebarHeader>
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
