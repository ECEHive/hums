import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";

export const Route = createFileRoute("/app/scheduling")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Scheduling />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [];

function Scheduling() {
	return (
		<div className="flex flex-col p-4">
			<p>Scheduling Page</p>
		</div>
	);
}
