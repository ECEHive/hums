import { createFileRoute } from "@tanstack/react-router";
import { ExitWithoutPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/")({
	component: () => ExitWithoutPermissions(permissions, <AppIndexLayout />),
});

export const permissions = [];

function AppIndexLayout() {
	return (
		<div className="flex flex-col p-4">
			<p>App Index Page</p>
		</div>
	);
}
