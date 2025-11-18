import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { formatDateInAppTimezone } from "@/lib/timezone";
import { DeleteDialog } from "./delete-dialog";
import { UpdateDialog } from "./update-dialog";

type Kiosk = {
	id: number;
	name: string;
	ipAddress: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export function generateColumns(): ColumnDef<Kiosk>[] {
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
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) =>
				formatDateInAppTimezone(row.original.createdAt, {
					formatString: "MMM D, YYYY",
				}),
		},
		{
			accessorKey: "modify",
			header: "Actions",
			cell: ({ row }) => {
				return (
					<div className="flex gap-2 items-center">
						<UpdateDialog kiosk={row.original} />
						<DeleteDialog kiosk={row.original} />
					</div>
				);
			},
		},
	];
}
