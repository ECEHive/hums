import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, RadioIcon, XCircle } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateInAppTimezone, formatTimeRange } from "@/lib/timezone";

export type ShiftOccurrenceRow = {
	id: number;
	timestamp: Date;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	slot: number;
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
	isActive?: boolean;
	isTappedIn?: boolean;
	canDrop: boolean;
	canMakeup: boolean;
	modificationWindow: {
		start: Date | null;
		end: Date | null;
		isOpen: boolean;
	};
	attendance?: {
		id: number;
		status: string;
		timeIn: Date | null;
		timeOut: Date | null;
		didArriveLate?: boolean;
		didLeaveEarly?: boolean;
		isMakeup?: boolean;
		droppedNotes?: string | null;
	} | null;
};

type ColumnOptions = {
	onDrop: (occurrence: ShiftOccurrenceRow) => void;
	onMakeup: (occurrence: ShiftOccurrenceRow) => void;
	canDropPermission: boolean;
	canMakeupPermission: boolean;
};

export function createColumns(
	options: ColumnOptions,
): ColumnDef<ShiftOccurrenceRow>[] {
	return [
		{
			accessorKey: "timestamp",
			header: "Date",
			cell: ({ row }) => (
				<span className="font-medium">
					{formatDateInAppTimezone(row.original.timestamp, {
						formatString: "MMM D, YYYY",
					})}
				</span>
			),
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
							{formatTimeRange(occurrence.startTime, occurrence.endTime, {
								referenceDate: occurrence.timestamp,
							})}
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

				const { status, didArriveLate, didLeaveEarly, isMakeup, droppedNotes } =
					occurrence.attendance;
				const badges: JSX.Element[] = [];
				if (isMakeup) {
					badges.push(
						<Badge key="makeup" variant="outline">
							Makeup
						</Badge>,
					);
				}
				if (didArriveLate) {
					badges.push(
						<Badge key="late" className="bg-yellow-600">
							Arrived Late
						</Badge>,
					);
				}
				if (didLeaveEarly) {
					badges.push(
						<Badge key="left-early" className="bg-orange-600">
							Left Early
						</Badge>,
					);
				}

				const statusBadge = (() => {
					switch (status) {
						case "upcoming":
							return (
								<Badge variant="outline" className="text-muted-foreground">
									Upcoming
								</Badge>
							);
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
						case "dropped":
						case "dropped_makeup":
							return (
								<div className="flex flex-col gap-1">
									<Badge variant="outline">
										{status === "dropped" ? "Dropped" : "Dropped + Makeup"}
									</Badge>
									{droppedNotes ? (
										<span className="text-xs text-muted-foreground">
											{droppedNotes}
										</span>
									) : null}
								</div>
							);
						default:
							return <Badge variant="outline">{status}</Badge>;
					}
				})();

				return (
					<div className="flex flex-col gap-1">
						{statusBadge}
						{badges.length > 0 ? (
							<div className="flex flex-wrap gap-1">{badges}</div>
						) : null}
					</div>
				);
			},
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				const occurrence = row.original;
				const canDrop = options.canDropPermission && occurrence.canDrop;
				const canMakeup = options.canMakeupPermission && occurrence.canMakeup;

				if (!canDrop && !canMakeup) {
					return (
						<span className="text-sm text-muted-foreground">Not available</span>
					);
				}

				return (
					<div className="flex flex-wrap gap-2">
						{canDrop ? (
							<Button
								size="sm"
								variant="secondary"
								onClick={() => options.onDrop(occurrence)}
							>
								Drop
							</Button>
						) : null}
						{canMakeup ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() => options.onMakeup(occurrence)}
							>
								Makeup
							</Button>
						) : null}
					</div>
				);
			},
		},
	];
}
