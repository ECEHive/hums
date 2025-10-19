import type { AppRouter } from "@ecehive/trpc/server";
import type { ColumnDef } from "@tanstack/react-table";
import type { inferRouterOutputs } from "@trpc/server";
import type { AuthUser } from "@/auth";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "../roles/deleteDialog";
import { PermissionsDialog } from "../roles/permissionsDialog";
import { RenameDialog } from "../roles/renameDialog";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Role = RouterOutput["roles"]["list"]["roles"][number];

export function generateColumns(user: AuthUser | null): ColumnDef<Role>[] {
	if (user === null) return [];
	const canEditPermissions = checkPermissions(user, [
		"rolePermissions.list",
		"rolePermissions.create",
		"rolePermissions.delete",
	]);
	const canRename = checkPermissions(user, ["roles.update"]);
	const canDelete = checkPermissions(user, ["roles.delete"]);

	return [
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
					(canEditPermissions && (
						<PermissionsDialog
							roleName={row.original.name as string}
							roleId={row.original.id as number}
							permissions={permissions}
						/>
					)) || (
						<span style={{ fontStyle: "italic", color: "#888" }}>
							No actions available
						</span>
					)
				);
			},
		},
		{
			accessorKey: "modify",
			header: "Modify",
			cell: ({ row }) => {
				return (
					<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
						{canRename && (
							<RenameDialog
								roleId={row.original.id}
								currentName={row.original.name}
							/>
						)}
						{canDelete && (
							<DeleteDialog
								roleId={row.original.id}
								roleName={row.original.name}
							/>
						)}
						{!canRename && !canDelete && (
							<span style={{ fontStyle: "italic", color: "#888" }}>
								No actions available
							</span>
						)}
					</div>
				);
			},
		},
	];
}
