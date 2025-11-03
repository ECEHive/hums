import type { ColumnDef } from "@tanstack/react-table";
import type { AuthUser } from "@/auth";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { EditPermissionsSheet } from "./edit-permissions-sheet";
import { RenameDialog } from "./rename-dialog";

export type UserReport = {
	id: number;
    name: string;
    username: string;
    shiftSchedule: {
        id: number;
        start: Date;
        end: Date;
    }[];
	permissions: {
		id: number;
		name: string;
	}[];
};

export function generateColumns(): ColumnDef<UserReport>[] {
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
				return <></>;
			},
		},
	];
}
