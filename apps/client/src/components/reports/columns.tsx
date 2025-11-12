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
			header: "Full Name",
		},
		{
			accessorKey: "username",
			header: "Username",
		},
		{
			accessorKey: "shiftOccurrences",
			header: "Shift Occurrences",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "shiftAttendances",
			header: "Shift Attendances",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "totalScheduledTime",
			header: "Total Scheduled Time",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "totalAttendedTime",
			header: "Total Attended Time",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "totalMissedTime",
			header: "Total Missed Time",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "attendancePercentage",
			header: "Attendance Percentage",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "shiftAnomalies",
			header: "No Shows",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "droppedShifts",
			header: "Dropped Shifts",
			cell: ({ row }) => {
				return <></>;
			},
		},
		{
			accessorKey: "scheduledMakeupShifts",
			header: "Makeup Shifts",
			cell: ({ row }) => {
				return <></>;
			},
		}
	];
}
