import { Link, useLocation } from "@tanstack/react-router";
import {
	BugIcon,
	CalendarIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	DoorOpenIcon,
	HomeIcon,
	LaptopMinimalCheckIcon,
	MoonIcon,
	ShieldIcon,
	SunIcon,
	SunMoonIcon,
	User2Icon,
	UserIcon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
import { useTheme } from "@/components/theme-provider";
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
import { permissions as kiosksPagePermissions } from "@/routes/app/kiosks";
import { permissions as rolesPagePermissions } from "@/routes/app/roles";
import { permissions as usersPagePermissions } from "@/routes/app/users";
import { permissions as schedulingIndexPagePermissions } from "@/routes/shifts/scheduling";
import { Logo } from "./logo";

// Sidebar menu items, grouped by section
type AppSidebarItem = {
	title: string;
	url: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	permissions: string[];
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
				url: "/shifts",
				icon: CalendarIcon,
				permissions: schedulingIndexPagePermissions,
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
				<Logo className="h-8 p-1" />
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
