import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";

export function OverviewHeader() {
	const { toggleSidebar } = useSidebar();

	return (
		<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8"
				onClick={toggleSidebar}
				aria-label="Toggle navigation menu"
			>
				<Menu className="h-5 w-5" />
			</Button>
			<Separator orientation="vertical" className="h-4" />
			<Logo className="h-6" />
		</header>
	);
}
