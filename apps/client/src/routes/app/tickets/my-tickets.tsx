import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/tickets/my-tickets")({
	component: MyTicketsLayout,
});

function MyTicketsLayout() {
	return <Outlet />;
}
