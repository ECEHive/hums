import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<Logo />
				</div>
				<Link to="/app">
					<Button size="lg" className="w-full">
						Enter App
					</Button>
				</Link>
			</div>
		</div>
	);
}
