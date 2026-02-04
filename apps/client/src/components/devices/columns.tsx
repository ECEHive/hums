import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateInAppTimezone } from "@/lib/timezone";
import { DeleteDialog } from "./delete-dialog";
import { UpdateDialog } from "./update-dialog";

type Device = {
	id: number;
	name: string;
	ipAddress: string;
	isActive: boolean;
	hasKioskAccess: boolean;
	hasDashboardAccess: boolean;
	hasInventoryAccess: boolean;
	hasControlAccess: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export function generateColumns(): ColumnDef<Device>[] {
	return [
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			accessorKey: "ipAddress",
			header: "IP Address",
			cell: ({ row }) => {
				return (
					<code className="text-sm font-mono">{row.original.ipAddress}</code>
				);
			},
		},
		{
			accessorKey: "isActive",
			header: "Status",
			cell: ({ row }) => {
				return (
					<Badge variant={row.original.isActive ? "secondary" : "outline"}>
						{row.original.isActive ? "Active" : "Inactive"}
					</Badge>
				);
			},
		},
		{
			accessorKey: "access",
			header: "Access",
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 flex-wrap">
						<Badge
							variant={row.original.hasKioskAccess ? "default" : "outline"}
							className="flex items-center gap-1"
						>
							{row.original.hasKioskAccess ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							Kiosk
						</Badge>
						<Badge
							variant={row.original.hasDashboardAccess ? "default" : "outline"}
							className="flex items-center gap-1"
						>
							{row.original.hasDashboardAccess ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							Dashboard
						</Badge>
						<Badge
							variant={row.original.hasInventoryAccess ? "default" : "outline"}
							className="flex items-center gap-1"
						>
							{row.original.hasInventoryAccess ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							Inventory
						</Badge>
						<Badge
							variant={row.original.hasControlAccess ? "default" : "outline"}
							className="flex items-center gap-1"
						>
							{row.original.hasControlAccess ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							Control
						</Badge>
					</div>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) =>
				formatDateInAppTimezone(row.original.createdAt, {
					formatString: "MMM D, YYYY",
				}),
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center justify-end">
						<UpdateDialog device={row.original} />
						<DeleteDialog device={row.original} />
					</div>
				);
			},
		},
	];
}
