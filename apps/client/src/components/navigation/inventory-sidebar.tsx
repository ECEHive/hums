import { Link, useLocation } from "@tanstack/react-router";
import {
	BugIcon,
	ChevronLeft,
	ChevronUpIcon,
	CirclePlusIcon,
	DoorOpenIcon,
	HistoryIcon,
	HomeIcon,
	LaptopMinimalCheckIcon,
	LayoutDashboardIcon,
	MoonIcon,
	SunIcon,
	SunMoonIcon,
	User2Icon,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthProvider";
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
import { checkPermissions } from "@/lib/permissions";

// Sidebar menu items, grouped by section
export const items = [
	{
		name: "Inventory",
		items: [
			{
				title: "Home",
				url: "/app/inventory",
				icon: HomeIcon,
				permissions: [],
			},
			{
				title: "Items",
				url: "/app/inventory/items",
				icon: LaptopMinimalCheckIcon,
				permissions: [],
			},
			{
				title: "My Transactions",
				url: "/app/inventory/my-transactions",
				icon: HistoryIcon,
				permissions: [],
			},
			{
				title: "Request Item",
				url: "/app/inventory/request-item",
				icon: CirclePlusIcon,
				permissions: [],
			},
		],
	},
	{
		name: "Admin",
		items: [
			{
				title: "Transactions",
				url: "/app/inventory/transactions",
				icon: HistoryIcon,
				permissions: [],
			},
			{
				title: "Item Requests",
				url: "/app/inventory/item-requests",
				icon: CirclePlusIcon,
				permissions: [],
			},
		],
	},
];

export function InventorySidebar() {
	const user = useCurrentUser();
	const { logout } = useAuth();
	const { setTheme } = useTheme();
	const location = useLocation();
	const { handleClick: handleLogoClick } = useGlitchEgg();
	const pathname = location?.pathname ?? "/";

	const canViewItem = (item: (typeof items)[number]["items"][number]) => {
		return checkPermissions(user, item.permissions);
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

	return (
		<Sidebar variant="floating" data-sidebar-id="inventory">
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
