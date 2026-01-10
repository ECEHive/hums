import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import React from "react";
import type { AuthUser } from "@/auth";
import { Button } from "@/components/ui/button";
import { checkPermissions } from "@/lib/permissions";
import { DeleteDialog } from "./delete-dialog";
import { EditShiftScheduleSheet } from "./edit-shift-schedule-sheet";

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

type ShiftSchedule = {
	id: number;
	periodId: number;
	shiftTypeId: number;
	shiftTypeName: string;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	createdAt: Date;
	updatedAt: Date;
};

export function generateColumns(
	user: AuthUser | null,
): ColumnDef<ShiftSchedule>[] {
	if (user === null) return [];

	const canEdit = checkPermissions(user, ["shift_schedules.update"]);
	const canDelete = checkPermissions(user, ["shift_schedules.delete"]);

	const columns: ColumnDef<ShiftSchedule>[] = [
		{
			accessorKey: "shiftTypeName",
			header: "Shift Type",
		},
		{
			accessorKey: "dayOfWeek",
			header: "Day",
			cell: ({ row }) => DAYS_OF_WEEK[row.original.dayOfWeek],
		},
		{
			id: "timeRange",
			header: "Time",
			cell: ({ row }) => `${row.original.startTime} - ${row.original.endTime}`,
		},
		{
			accessorKey: "slots",
			header: "Slots",
		},
	];

	// Add actions column if user has edit or delete permissions
	if (canEdit || canDelete) {
		columns.push({
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
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
									aria-label="Edit shift schedule"
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<EditShiftScheduleSheet
									open={editSheetOpen}
									onOpenChange={setEditSheetOpen}
									shiftSchedule={row.original}
								/>
							</>
						)}
						{canDelete && (
							<DeleteDialog
								shiftScheduleId={row.original.id}
								shiftTypeName={row.original.shiftTypeName}
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
