import { Link, useLocation } from "@tanstack/react-router";
import {
	ExternalLinkIcon,
	HomeIcon,
	MoonIcon,
	SunIcon,
	UsersIcon,
} from "lucide-react";
import { useDevice } from "@/components/providers/device-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type SidebarItem = {
	title: string;
	url: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	requiresDashboardAccess?: boolean;
};

const mainItems: SidebarItem[] = [
	{
		title: "Overview",
		url: "/",
		icon: HomeIcon,
	},
	{
		title: "Staffing",
		url: "/staffing",
		icon: UsersIcon,
		requiresDashboardAccess: true,
	},
];

export function OverviewSidebar() {
	const location = useLocation();
	const pathname = location?.pathname ?? "/";
	const { theme, setTheme } = useTheme();
	const { isDevice, hasDashboardAccess } = useDevice();

	const isPathActive = (itemUrl: string) => {
		const normalizedPath = pathname.replace(/\/+$/, "");
		const normalizedItem = itemUrl.replace(/\/+$/, "");

		return normalizedPath === normalizedItem;
	};

	const visibleItems = mainItems.filter((item) => {
		if (item.requiresDashboardAccess) {
			return hasDashboardAccess;
		}
		return true;
	});

	const toggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark");
	};

	return (
		<Sidebar variant="floating">
			<SidebarHeader className="p-4">
				<Logo className="h-10" />
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{visibleItems.map((item) => (
								<SidebarMenuItem key={item.url}>
									<SidebarMenuButton asChild isActive={isPathActive(item.url)}>
										<Link to={item.url}>
											<item.icon className="h-4 w-4" />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="p-4 space-y-2">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleTheme}
								className="w-full"
							>
								<SunIcon className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
								<MoonIcon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
								<span className="sr-only">Toggle theme</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">
							<p>Toggle theme</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				{!isDevice && (
					<Button variant="outline" className="w-full justify-start" asChild>
						<a href="/login" target="_blank" rel="noopener noreferrer">
							<ExternalLinkIcon className="h-4 w-4 mr-2" />
							Open HUMS
						</a>
					</Button>
				)}
			</SidebarFooter>
		</Sidebar>
	);
}
