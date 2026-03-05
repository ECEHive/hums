import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/booking/book")({
	component: BookLayout,
});

function BookLayout() {
	return <Outlet />;
}
