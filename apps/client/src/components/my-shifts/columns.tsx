import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Clock } from "lucide-react";

type ShiftOccurrence = {
	id: number;
	timestamp: Date;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	slot: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
};

function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const period = hours >= 12 ? "PM" : "AM";
	const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
	return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export const columns: ColumnDef<ShiftOccurrence>[] = [
	{
		accessorKey: "timestamp",
		header: "Date",
		cell: ({ row }) => {
			const occurrence = row.original;
			return (
				<span className="font-medium">
					{format(new Date(occurrence.timestamp), "MMM d, yyyy")}
				</span>
			);
		},
	},
	{
		accessorKey: "startTime",
		header: "Time",
		cell: ({ row }) => {
			const occurrence = row.original;
			return (
				<div className="flex items-center gap-1">
					<Clock className="w-4 h-4 text-muted-foreground" />
					<span>
						{formatTime(occurrence.startTime)} -{" "}
						{formatTime(occurrence.endTime)}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "shiftTypeName",
		header: "Type",
		cell: ({ row }) => {
			const occurrence = row.original;
			return (
				<div className="flex items-center gap-2">
					{occurrence.shiftTypeColor && (
						<div
							className="w-3 h-3 rounded-full border"
							style={{
								backgroundColor: occurrence.shiftTypeColor,
							}}
						/>
					)}
					<span>{occurrence.shiftTypeName}</span>
				</div>
			);
		},
	},
];
