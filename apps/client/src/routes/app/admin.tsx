import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/admin")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>live laugh hive</div>;
}
