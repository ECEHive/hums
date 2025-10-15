import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";

export const Route = createFileRoute("/app/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AppIndexLayout />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [];

function AppIndexLayout() {
	return (
		<div className="flex flex-col p-4">
			<p>App Index Page</p>
		</div>
	);
}
