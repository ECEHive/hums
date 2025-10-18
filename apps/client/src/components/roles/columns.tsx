import type { AppRouter } from "@ecehive/trpc/server";
import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import { PermissionsDialog } from "../roles/permissionsDialog";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Role = RouterOutput["roles"]["list"];

export const columns: ColumnDef<Role>[] = [
	{
		accessorKey: "name",
		header: "Role",
	},
	{
		accessorKey: "userCount",
		header: "User Count",
	},
	{
		accessorKey: "permissions",
		header: "Permissions",
		cell: ({ row }) => {
			const permissions = row.original.permissions as { id: number; name: string }[];

			if (!permissions?.length) {
				return <span className="text-muted-foreground italic">No permissions</span>;
			}

			return (
				<PermissionsDialog roleName={row.original.name as string} roleId={row.original.id as number} permissions={permissions} />
			);
		},
	},
];
