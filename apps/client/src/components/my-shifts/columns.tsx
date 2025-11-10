import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle2, Clock, RadioIcon, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
	isActive?: boolean;
	isTappedIn?: boolean;
	attendance?: {
		id: number;
		status: string;
		timeIn: Date | null;
		timeOut: Date | null;
	} | null;
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
	{
		accessorKey: "attendance",
		header: "Status",
		cell: ({ row }) => {
			const occurrence = row.original;
			const now = new Date();
			const shiftTime = new Date(occurrence.timestamp);
			const hasOccurred = shiftTime < now;

			// Active shift indicators
			if (occurrence.isActive) {
				if (occurrence.isTappedIn) {
					return (
						<div className="flex items-center gap-1">
							<Badge className="bg-green-600 animate-pulse">
								<RadioIcon className="w-3 h-3 mr-1" />
								Active & Present
							</Badge>
						</div>
					);
				}
				return (
					<div className="flex items-center gap-1">
						<Badge className="bg-yellow-600 animate-pulse">
							<RadioIcon className="w-3 h-3 mr-1" />
							Active (Not Tapped In)
						</Badge>
					</div>
				);
			}

			// Future shifts
			if (!hasOccurred) {
				return (
					<Badge variant="outline" className="text-muted-foreground">
						Upcoming
					</Badge>
				);
			}

			// Past shifts - check attendance
			if (!occurrence.attendance) {
				return (
					<div className="flex items-center gap-1 text-muted-foreground">
						<XCircle className="w-4 h-4" />
						<span className="text-sm">No record</span>
					</div>
				);
			}

			const { status } = occurrence.attendance;

			switch (status) {
				case "present":
					return (
						<div className="flex items-center gap-1 text-green-600">
							<CheckCircle2 className="w-4 h-4" />
							<span className="text-sm font-medium">Present</span>
						</div>
					);
				case "absent":
					return (
						<div className="flex items-center gap-1 text-red-600">
							<XCircle className="w-4 h-4" />
							<span className="text-sm font-medium">Absent</span>
						</div>
					);
				case "arrived_late":
					return <Badge className="bg-yellow-600">Late</Badge>;
				case "left_early":
					return <Badge className="bg-orange-600">Left Early</Badge>;
				default:
					return <Badge variant="outline">{status}</Badge>;
			}
		},
	},
];
