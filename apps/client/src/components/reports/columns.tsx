import type { ColumnDef } from "@tanstack/react-table";

export type UserReport = {
	id: number;
	name: string;
	username: string;
	periodScheduledTime: number;
	pastScheduledTime: number;
	pastAttendedTime: number;
	pastMissedTime: number;
	pastAttendancePercentage: number;
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
			accessorKey: "periodScheduledTime",
			header: "Scheduled Time For Period",
			cell: ({ row }) => {
				return <span>{row.original.periodScheduledTime.toFixed(2)} hrs</span>;
			},
		},
		{
			accessorKey: "pastScheduledTime",
			header: "Past Scheduled Time",
			cell: ({ row }) => {
				return <span>{row.original.pastScheduledTime.toFixed(2)} hrs</span>;
			},
		},
		{
			accessorKey: "pastAttendedTime",
			header: "Past Attended Time",
			cell: ({ row }) => {
				return <span>{row.original.pastAttendedTime.toFixed(2)} hrs</span>;
			},
		},
		{
			accessorKey: "pastMissedTime",
			header: "Past Missed Time",
			cell: ({ row }) => {
				return <span>{row.original.pastMissedTime.toFixed(2)} hrs</span>;
			},
		},
		{
			accessorKey: "pastAttendancePercentage",
			header: "Past Attendance Percentage",
			cell: ({ row }) => {
				return <span>{row.original.pastAttendancePercentage.toFixed(2)}%</span>;
			},
		},
	];
}
