import type { ColumnDef } from "@tanstack/react-table";

export type UserReport = {
	id: number;
	name: string;
	username: string;
	totalScheduledTime: number;
	totalAttendedTime: number;
	totalMissedTime: number;
	attendancePercentage: number;
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
			accessorKey: "totalScheduledTime",
			header: "Total Scheduled Time",
			cell: ({ row }) => {
				return <span>{row.original.totalScheduledTime} hrs</span>;
			},
		},
		{
			accessorKey: "totalAttendedTime",
			header: "Total Attended Time",
			cell: ({ row }) => {
				return <span>{row.original.totalAttendedTime}%</span>;
			},
		},
		{
			accessorKey: "totalMissedTime",
			header: "Total Missed Time",
			cell: ({ row }) => {
				return <span>{row.original.totalMissedTime}%</span>;
			},
		},
		{
			accessorKey: "attendancePercentage",
			header: "Attendance Percentage",
			cell: ({ row }) => {
				return <span>{row.original.attendancePercentage}%</span>;
			},
		},
	];
}
