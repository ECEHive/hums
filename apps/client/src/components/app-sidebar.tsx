import { Link, useLocation } from "@tanstack/react-router";
import {
	CalendarIcon,
	ChevronUpIcon,
	HomeIcon,
	NotebookTextIcon,
	ShieldIcon,
	ShieldUserIcon,
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
import { permissions as adminPagePermissions } from "@/routes/app/admin";
import { permissions as appIndexPagePermissions } from "@/routes/app/index";
import { permissions as schedulingPagePermissions } from "@/routes/app/scheduling";
import { Logo } from "./logo";

// Removed ModeToggle button in favor of options inside the user dropdown

// Menu items.
// Grouped menu items. Each group has an optional `name` and an `items` array.
// If a group's items are all filtered out by permissions, the whole group will be hidden.
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
				url: "/app/admin",
				icon: ShieldIcon,
				permissions: adminPagePermissions, // Example, will be changed based on real permissions
			},
			{
				title: "Users",
				url: "/app/admin",
				icon: UserIcon,
				permissions: adminPagePermissions, // Example, will be changed based on real permissions
			},
			{
				title: "Periods",
				url: "/app/admin",
				icon: CalendarIcon,
				permissions: adminPagePermissions, // Example, will be changed based on real permissions
			},
			{
				title: "Reports",
				url: "/app/admin",
				icon: NotebookTextIcon,
				permissions: adminPagePermissions, // Example, will be changed based on real permissions
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
									Light
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setTheme("dark")}>
									Dark
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setTheme("system")}>
									System
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => logout()}>
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
