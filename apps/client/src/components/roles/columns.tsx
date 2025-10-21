import type { ColumnDef } from "@tanstack/react-table";
import type { AuthUser } from "@/auth";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { PermissionsDialog } from "./permissions-dialog";
import { RenameDialog } from "./rename-dialog";

type Role = {
	id: number;
	name: string;
	userCount: number;
	permissions: {
		id: number;
		name: string;
	}[];
};

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
				return (
					(canEditPermissions && <PermissionsDialog role={row.original} />) || (
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
						{canRename && <RenameDialog role={row.original} />}
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
