import { createFileRoute, redirect } from "@tanstack/react-router";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/")({
	component: Index,
	loader: () => {
		throw redirect({ to: "/app" });
	},
});

function Index() {
	return (
		<div className="flex flex-col h-screen w-screen items-center justify-center bg-background">
			<Spinner />
			<div className="p-4 text-sm text-muted-foreground">Loading the app…</div>
		</div>
	);
}
