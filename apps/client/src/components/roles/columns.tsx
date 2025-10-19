import type { AppRouter } from "@ecehive/trpc/server";
import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import { DeleteDialog } from "../roles/deleteDialog";
import { PermissionsDialog } from "../roles/permissionsDialog";
import { RenameDialog } from "../roles/renameDialog";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Role = RouterOutput["roles"]["list"]["roles"][number];

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
			const permissions = row.original.permissions as {
				id: number;
				name: string;
			}[];

			return (
				<PermissionsDialog
					roleName={row.original.name as string}
					roleId={row.original.id as number}
					permissions={permissions}
				/>
			);
		},
	},
	{
		accessorKey: "modify",
		header: "Modify",
		cell: ({ row }) => {
			return (
				<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
					<RenameDialog
						roleId={row.original.id}
						currentName={row.original.name}
					/>
					<DeleteDialog roleId={row.original.id} roleName={row.original.name} />
				</div>
			);
		},
	},
];
