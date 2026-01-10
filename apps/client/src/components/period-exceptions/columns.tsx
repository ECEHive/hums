import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import React from "react";
import type { AuthUser } from "@/auth";
import { Button } from "@/components/ui/button";
import { checkPermissions } from "@/lib/permissions";
import { formatInAppTimezone } from "@/lib/timezone";
import { DeletePeriodExceptionDialog } from "./delete-dialog";
import { EditPeriodExceptionSheet } from "./edit-period-exception-sheet";
import type { PeriodExceptionRow } from "./types";

export function generateColumns(
	user: AuthUser | null,
): ColumnDef<PeriodExceptionRow>[] {
	if (!user) return [];

	const canEdit = checkPermissions(user, ["period_exceptions.update"]);
	const canDelete = checkPermissions(user, ["period_exceptions.delete"]);

	const columns: ColumnDef<PeriodExceptionRow>[] = [
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			id: "start",
			header: "Start",
			cell: ({ row }) =>
				formatInAppTimezone(row.original.start, {
					includeTimezoneWhenDifferent: true,
				}),
		},
		{
			id: "end",
			header: "End",
			cell: ({ row }) =>
				formatInAppTimezone(row.original.end, {
					includeTimezoneWhenDifferent: true,
				}),
		},
	];

	if (canEdit || canDelete) {
		columns.push({
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				const [editOpen, setEditOpen] = React.useState(false);

				return (
					<div className="flex items-center justify-end gap-2">
						{canEdit && (
							<>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setEditOpen(true)}
									aria-label={`Edit period exception ${row.original.name}`}
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<EditPeriodExceptionSheet
									open={editOpen}
									onOpenChange={setEditOpen}
									periodException={row.original}
								/>
							</>
						)}
						{canDelete && (
							<DeletePeriodExceptionDialog periodException={row.original} />
						)}
					</div>
				);
			},
		});
	}

	return columns;
}
