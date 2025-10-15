import { Link } from "@tanstack/react-router";
import { Calendar, ChevronUp, Home, ShieldUser, User2 } from "lucide-react";
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
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { checkPermissions } from "@/lib/permissions";
import { permissions as adminPagePermissions } from "@/routes/app/admin";
import { permissions as appIndexPagePermissions } from "@/routes/app/index";
import { permissions as schedulingPagePermissions } from "@/routes/app/scheduling";

// Removed ModeToggle button in favor of options inside the user dropdown

// Menu items.
export const items = [
	{
		title: "Home",
		url: "/app",
		icon: Home,
		permissions: appIndexPagePermissions,
	},
	{
		title: "Scheduling",
		url: "/app/scheduling",
		icon: Calendar,
		permissions: schedulingPagePermissions,
	},
	{
		title: "Admin",
		url: "/app/admin",
		icon: ShieldUser,
		permissions: adminPagePermissions, // Example, will be changed based on real permissions
	},
];

export function AppSidebar() {
	const user = useCurrentUser();
	const { logout } = useAuth();
	const { setTheme } = useTheme();
	return (
		<Sidebar>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Hive Shift Scheduler</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{items
								.filter((item) => checkPermissions(user, item.permissions))
								.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton asChild>
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
			</SidebarContent>
			<SidebarFooter>
				{/* User dropdown with theme options */}
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<User2 /> {user?.name ?? user?.email ?? "Account"}
									<ChevronUp className="ml-auto" />
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
				{/* Removed ModeToggle button */}
			</SidebarFooter>
		</Sidebar>
	);
}
