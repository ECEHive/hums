import { Link, useLocation } from "@tanstack/react-router";
import {
	BugIcon,
	CalendarIcon,
	ChevronUpIcon,
	DoorOpenIcon,
	HomeIcon,
	LaptopMinimalCheckIcon,
	MoonIcon,
	NotebookTextIcon,
	ShieldIcon,
	SunIcon,
	SunMoonIcon,
	User2Icon,
	UserIcon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { useTheme } from "@/components/theme-provider"; // Import useTheme from theme-provider
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
import { checkPermissions } from "@/lib/permissions";
import { permissions as appIndexPagePermissions } from "@/routes/app/index";
// import { permissions as reportsPagePermissions } from "@/routes/app/reports"; --- To be implemented
import { permissions as kiosksPagePermissions } from "@/routes/app/kiosks";
import { permissions as periodsPagePermissions } from "@/routes/app/periods";
import { permissions as rolesPagePermissions } from "@/routes/app/roles";
import { permissions as schedulingPagePermissions } from "@/routes/app/scheduling";
import { permissions as usersPagePermissions } from "@/routes/app/users";
import { Logo } from "./logo";

// Sidebar menu items, grouped by section
export const items = [
	{
		items: [
			{
				title: "Home",
				url: "/app",
				icon: HomeIcon,
				permissions: appIndexPagePermissions,
			},
			{
				title: "Scheduling",
				url: "/app/scheduling",
				icon: CalendarIcon,
				permissions: schedulingPagePermissions,
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
				title: "Periods",
				url: "/app/periods",
				icon: CalendarIcon,
				permissions: periodsPagePermissions,
			},
			{
				title: "Reports",
				url: "/app/reports", // To be implemented
				icon: NotebookTextIcon,
				permissions: [], //reportsPagePermissions,
			},
			{
				title: "Kiosks",
				url: "/app/kiosks",
				icon: LaptopMinimalCheckIcon,
				permissions: kiosksPagePermissions,
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

	// Collect all visible items across all groups to find the best match
	const allVisibleItems = items.flatMap((group) =>
		group.items.filter((item) => checkPermissions(user, item.permissions)),
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

	return (
		<Sidebar>
			<SidebarHeader>
				<Logo className="h-8" />
			</SidebarHeader>
			<SidebarContent>
				{items.map((group) => {
					const visibleItems = group.items.filter((item) =>
						checkPermissions(user, item.permissions),
					);
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
