import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app")({
	component: AppRoot,
});

function AppRoot() {
	return <Outlet />;
}
