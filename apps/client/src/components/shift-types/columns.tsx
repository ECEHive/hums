import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import React from "react";
import type { AuthUser } from "@/auth";
import { Button } from "@/components/ui/button";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { EditShiftTypeSheet } from "./edit-shift-type-sheet";

type ShiftType = {
	id: number;
	name: string;
	location: string;
	periodId: number;
	description: string | null;
	color: string | null;
	icon: string | null;
	isBalancedAcrossOverlap: boolean;
	isBalancedAcrossDay: boolean;
	isBalancedAcrossPeriod: boolean;
	canSelfAssign: boolean;
	doRequireRoles: "disabled" | "all" | "any";
	createdAt: Date;
	updatedAt: Date;
};

export function generateColumns(user: AuthUser | null): ColumnDef<ShiftType>[] {
	if (user === null) return [];

	const canEdit = checkPermissions(user, ["shift_types.update"]);
	const canDelete = checkPermissions(user, ["shift_types.delete"]);

	const columns: ColumnDef<ShiftType>[] = [
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			accessorKey: "location",
			header: "Location",
		},
	];

	// Add actions column if user has edit or delete permissions
	if (canEdit || canDelete) {
		columns.push({
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const [editSheetOpen, setEditSheetOpen] = React.useState(false);

				return (
					<div className="flex items-center gap-2">
						{canEdit && (
							<>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setEditSheetOpen(true)}
									aria-label="Edit shift type"
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<EditShiftTypeSheet
									open={editSheetOpen}
									onOpenChange={setEditSheetOpen}
									shiftType={row.original}
								/>
							</>
						)}
						{canDelete && (
							<DeleteDialog
								shiftTypeId={row.original.id}
								shiftTypeName={row.original.name}
								periodId={row.original.periodId}
							/>
						)}
					</div>
				);
			},
		});
	}

	return columns;
}
