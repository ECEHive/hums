import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatInAppTimezone } from "@/lib/timezone";

type Session = {
	id: number;
	userId: number;
	sessionType: "regular" | "staffing";
	startedAt: Date;
	endedAt: Date | null;
	user: {
		id: number;
		name: string;
		username: string;
		email: string;
	};
};

const formatDate = (date: Date) => formatInAppTimezone(date);

const formatDuration = (start: Date, end: Date | null) => {
	const startTime = new Date(start).getTime();
	const endTime = end ? new Date(end).getTime() : Date.now();
	const durationMs = endTime - startTime;
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
	return `${hours}h ${minutes}m`;
};

export const columns: ColumnDef<Session>[] = [
	{
		accessorKey: "user.name",
		header: "User",
		cell: ({ row }) => {
			const session = row.original;
			return (
				<div className="flex flex-col">
					<span className="font-medium">{session.user.name}</span>
					<span className="text-xs text-muted-foreground">
						{session.user.username}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "sessionType",
		header: "Type",
		cell: ({ row }) => {
			const session = row.original;
			return (
				<Badge
					variant={session.sessionType === "staffing" ? "default" : "outline"}
				>
					{session.sessionType === "staffing" ? "Staffing" : "Regular"}
				</Badge>
			);
		},
	},
	{
		accessorKey: "startedAt",
		header: "Started",
		cell: ({ row }) => formatDate(row.original.startedAt),
	},
	{
		accessorKey: "endedAt",
		header: "Ended",
		cell: ({ row }) => {
			const session = row.original;
			return session.endedAt ? formatDate(session.endedAt) : "-";
		},
	},
	{
		id: "duration",
		header: "Duration",
		cell: ({ row }) => {
			const session = row.original;
			return formatDuration(session.startedAt, session.endedAt);
		},
	},
	{
		id: "status",
		header: "Status",
		cell: ({ row }) => {
			const session = row.original;
			return session.endedAt ? (
				<span className="text-muted-foreground">Ended</span>
			) : (
				<span className="text-green-600 font-medium">Active</span>
			);
		},
	},
];
