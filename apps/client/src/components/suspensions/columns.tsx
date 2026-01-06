import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import type { AuthUser } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { checkPermissions } from "@/lib/permissions";
import { SuspensionUpdateDialog } from "./update-dialog";

type Suspension = {
	id: number;
	startDate: Date;
	endDate: Date;
	internalNotes: string | null;
	externalNotes: string | null;
	createdAt: Date;
	user: {
		id: number;
		name: string;
		username: string;
		email: string;
	};
	createdBy: {
		id: number;
		name: string;
		username: string;
	} | null;
};

export type { Suspension };

function getSuspensionStatus(
	startDate: Date,
	endDate: Date,
): "active" | "upcoming" | "expired" {
	const now = new Date();
	if (endDate <= now) return "expired";
	if (startDate <= now && endDate > now) return "active";
	return "upcoming";
}

export function generateColumns(
	user: AuthUser | null,
): ColumnDef<Suspension>[] {
	if (user === null) return [];

	const canManage = checkPermissions(user, ["suspensions.manage"]);

	return [
		{
			accessorKey: "user.name",
			header: "User",
			cell: ({ row }) => {
				const suspension = row.original;
				return (
					<div className="flex flex-col">
						<span className="font-medium">{suspension.user.name}</span>
						<span className="text-sm text-muted-foreground">
							{suspension.user.username}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				const suspension = row.original;
				const status = getSuspensionStatus(
					suspension.startDate,
					suspension.endDate,
				);

				const variants = {
					active: "destructive" as const,
					upcoming: "warning" as const,
					expired: "secondary" as const,
				};

				const labels = {
					active: "Active",
					upcoming: "Upcoming",
					expired: "Expired",
				};

				return <Badge variant={variants[status]}>{labels[status]}</Badge>;
			},
		},
		{
			accessorKey: "startDate",
			header: "Start Date",
			cell: ({ row }) => {
				const date = row.original.startDate;
				return format(date, "MMM d, yyyy h:mm a");
			},
		},
		{
			accessorKey: "endDate",
			header: "End Date",
			cell: ({ row }) => {
				const date = row.original.endDate;
				return format(date, "MMM d, yyyy h:mm a");
			},
		},
		{
			accessorKey: "createdBy",
			header: "Created By",
			cell: ({ row }) => {
				const createdBy = row.original.createdBy;
				return createdBy ? createdBy.name : "—";
			},
		},
		{
			accessorKey: "actions",
			header: "",
			cell: ({ row }) => {
				if (!canManage) return null;
				return (
					<div className="flex gap-2 items-center">
						<SuspensionUpdateDialog suspension={row.original} />
					</div>
				);
			},
		},
	];
}
