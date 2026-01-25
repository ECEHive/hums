import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatInAppTimezone, formatTimeRange } from "@/lib/timezone";

type AttendanceRecord = {
	id: number;
	status: string;
	timeIn: Date | null;
	timeOut: Date | null;
	timeOnShiftPercentage: number | null;
	didArriveLate: boolean | null;
	didLeaveEarly: boolean | null;
	isMakeup: boolean | null;
	isExcused: boolean;
	excuseNotes: string | null;
	excusedBy: { id: number; name: string } | null;
	excusedAt: Date | null;
	droppedNotes: string | null;
	shiftOccurrence: {
		timestamp: Date;
		shiftSchedule: {
			dayOfWeek: number;
			startTime: string;
			endTime: string;
			shiftType: {
				name: string;
				location: string | null;
			};
		};
	};
};

const formatDate = (date: Date) => formatInAppTimezone(date);

const formatDuration = (timeIn: Date | null, timeOut: Date | null) => {
	if (!timeIn) return "-";
	const startTime = new Date(timeIn).getTime();
	const endTime = timeOut ? new Date(timeOut).getTime() : Date.now();
	const durationMs = endTime - startTime;
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
	return `${hours}h ${minutes}m`;
};

const getDayOfWeek = (dayNum: number) => {
	const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	return days[dayNum];
};

export const columns: ColumnDef<AttendanceRecord>[] = [
	{
		id: "shift",
		header: "Shift",
		cell: ({ row }) => {
			const attendance = row.original;
			return (
				<div className="flex flex-col">
					<span className="font-medium">
						{attendance.shiftOccurrence.shiftSchedule.shiftType.name}
					</span>
					<span className="text-xs text-muted-foreground">
						{attendance.shiftOccurrence.shiftSchedule.shiftType.location}
					</span>
				</div>
			);
		},
	},
	{
		id: "dateTime",
		header: "Date & Time",
		cell: ({ row }) => {
			const attendance = row.original;
			return (
				<div className="flex flex-col">
					<span>{formatDate(attendance.shiftOccurrence.timestamp)}</span>
					<span className="text-xs text-muted-foreground">
						{getDayOfWeek(attendance.shiftOccurrence.shiftSchedule.dayOfWeek)}{" "}
						{formatTimeRange(
							attendance.shiftOccurrence.shiftSchedule.startTime,
							attendance.shiftOccurrence.shiftSchedule.endTime,
							{
								referenceDate: attendance.shiftOccurrence.timestamp,
							},
						)}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => {
			const attendance = row.original;
			const getStatusBadge = () => {
				// Check if excused first (can be excused with any underlying status)
				if (attendance.isExcused) {
					return <Badge>Excused</Badge>;
				}

				switch (attendance.status) {
					case "upcoming":
						return (
							<Badge variant="outline" className="text-muted-foreground">
								Upcoming
							</Badge>
						);
					case "present":
						return <Badge className="bg-green-600">Present</Badge>;
					case "absent":
						return <Badge variant="destructive">Absent</Badge>;
					case "excused":
						return <Badge className="bg-blue-600">Excused</Badge>;
					case "dropped":
					case "dropped_makeup":
						return (
							<Badge variant="outline">
								{attendance.status === "dropped"
									? "Dropped"
									: "Dropped w/ Makeup"}
							</Badge>
						);
					default:
						return <Badge variant="outline">{attendance.status}</Badge>;
				}
			};

			const renderStatusFlags = () => {
				const badges: React.ReactNode[] = [];
				if (attendance.isMakeup) {
					badges.push(
						<Badge key="makeup" variant="outline">
							Makeup
						</Badge>,
					);
				}
				if (attendance.didArriveLate) {
					badges.push(
						<Badge key="late" className="bg-yellow-600">
							Arrived Late
						</Badge>,
					);
				}
				if (attendance.didLeaveEarly) {
					badges.push(
						<Badge key="left-early" className="bg-orange-600">
							Left Early
						</Badge>,
					);
				}
				return badges.length > 0 ? (
					<div className="flex flex-wrap gap-1">{badges}</div>
				) : null;
			};

			return (
				<div className="flex flex-col gap-1">
					{getStatusBadge()}
					{renderStatusFlags()}
				</div>
			);
		},
	},
	{
		id: "timeIn",
		header: "Time In",
		cell: ({ row }) => {
			const attendance = row.original;
			return attendance.timeIn ? formatDate(attendance.timeIn) : "-";
		},
	},
	{
		id: "timeOut",
		header: "Time Out",
		cell: ({ row }) => {
			const attendance = row.original;
			return attendance.timeOut ? formatDate(attendance.timeOut) : "-";
		},
	},
	{
		id: "duration",
		header: "Duration",
		cell: ({ row }) => {
			const attendance = row.original;
			return formatDuration(attendance.timeIn, attendance.timeOut);
		},
	},
	{
		id: "timeOnShift",
		header: "% On Shift",
		cell: ({ row }) => {
			const attendance = row.original;
			if (
				attendance.timeOnShiftPercentage !== null &&
				attendance.timeOnShiftPercentage !== undefined
			) {
				return (
					<span
						className={
							attendance.timeOnShiftPercentage >= 90
								? "text-green-600 font-medium"
								: attendance.timeOnShiftPercentage >= 70
									? "text-yellow-600 font-medium"
									: "text-orange-600 font-medium"
						}
					>
						{attendance.timeOnShiftPercentage}%
					</span>
				);
			}
			return <span className="text-muted-foreground">-</span>;
		},
	},
];
