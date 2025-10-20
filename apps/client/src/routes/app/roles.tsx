import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { generateColumns } from "@/components/roles/columns";
import { CreateDialog } from "@/components/roles/createDialog";
import { DataTable } from "@/components/roles/data-table";

export const Route = createFileRoute("/app/roles")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Roles />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["roles.list"];

function Roles() {
	const { data } = useQuery({
		queryKey: ["roles"],
		queryFn: async () => {
			return await trpc.roles.list.query({});
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);

	return (
		<div className="container p-4 space-y-3">
			<DataTable columns={columns} data={data?.roles ?? []} />
			<CreateDialog />
		</div>
	);
}
