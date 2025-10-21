import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { NotFound } from "@/components/not-found";

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
		<>
			{/* Placeholder content */}
			<NotFound />
		</>
	);
}
