import { createFileRoute } from "@tanstack/react-router";
import { ExitWithoutPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/scheduling")({
	component: () => ExitWithoutPermissions(permissions, <Scheduling />),
});

export const permissions = [];

function Scheduling() {
	return (
		<div className="flex flex-col p-4">
			<p>Scheduling Page</p>
		</div>
	);
}
