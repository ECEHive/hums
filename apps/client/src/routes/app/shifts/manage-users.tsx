import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/shifts/manage-users")({
	component: ManageUsersLayout,
});

function ManageUsersLayout() {
	return <Outlet />;
}
