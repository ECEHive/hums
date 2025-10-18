import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { columns } from "@/components/roles/columns";
import { DataTable } from "@/components/roles/data-table";
import { CreateDialog } from "@/components/roles/createDialog";

export const Route = createFileRoute("/app/roles")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Roles />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [];

function Roles() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["roles"],
		queryFn: async () => {
			return await trpc.roles.list.query({});
		},
		retry: false,
	});

	return (
		<div className="container p-4 space-y-3">
			<DataTable columns={columns} data={data?.roles ?? []} />
			<CreateDialog />
		</div>
	);
}
