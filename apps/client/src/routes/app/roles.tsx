import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { columns } from "@/components/roles/columns";
import { DataTable } from "@/components/roles/data-table";

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
			const res = await trpc.roles.list.query({});
			console.log(res);
			return res;
		},
		retry: false,
	});

	return (
		<div className="container mx-auto py-10">
			<DataTable columns={columns} data={data?.roles ?? []} />
		</div>
	);
}
