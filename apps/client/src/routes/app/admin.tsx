import { createFileRoute } from "@tanstack/react-router";
import { ExitWithoutPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/admin")({
	component: () => ExitWithoutPermissions(permissions, <Admin />),
});

export const permissions = ["admin"];

function Admin() {
	return (
		<div className="flex flex-col p-4">
			<p>live laugh hive</p>
		</div>
	);
}
