import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";

export const Route = createFileRoute("/app/admin")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Admin />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["admin"];

function Admin() {
	return (
		<div className="flex flex-col p-4">
			<p>live laugh hive</p>
		</div>
	);
}
