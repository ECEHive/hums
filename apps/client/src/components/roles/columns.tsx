import type { ColumnDef } from "@tanstack/react-table";
import type { AuthUser } from "@/auth";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { EditPermissionsSheet } from "./edit-permissions-sheet";
import { RenameDialog } from "./rename-dialog";

export type Role = {
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
		"permissions.list",
		"roles.update",
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
					(canEditPermissions && (
						<EditPermissionsSheet role={row.original} />
					)) || (
						<span style={{ fontStyle: "italic", color: "#888" }}>
							No actions available
						</span>
					)
				);
			},
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center justify-end">
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
