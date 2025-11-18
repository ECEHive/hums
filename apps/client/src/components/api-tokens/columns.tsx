import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatInAppTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { ApiTokenRow } from "./types";

export function createTokenColumns(options: {
	renderActions?: (token: ApiTokenRow) => ReactNode;
}): ColumnDef<ApiTokenRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<div className="space-y-1 font-medium">{row.original.name}</div>
			),
		},
		{
			accessorKey: "preview",
			header: "Preview",
			cell: ({ row }) => (
				<code className="rounded bg-muted px-2 py-1 text-xs">
					{row.original.preview}
				</code>
			),
			meta: { className: "w-[180px]" },
		},
		{
			accessorKey: "isExpired",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={row.original.isExpired ? "destructive" : "secondary"}
					className={cn("gap-1", row.original.isExpired && "bg-destructive/10")}
				>
					{row.original.isExpired ? "Expired" : "Active"}
				</Badge>
			),
		},
		{
			accessorKey: "lastUsedAt",
			header: "Last Used",
			cell: ({ row }) => <span>{formatDate(row.original.lastUsedAt)}</span>,
		},
		{
			accessorKey: "expiresAt",
			header: "Expires",
			cell: ({ row }) => (
				<span>
					{row.original.expiresAt ? (
						formatDate(row.original.expiresAt)
					) : (
						<span className="text-muted-foreground">No expiry</span>
					)}
				</span>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => (
				<div className="flex justify-end">
					{options.renderActions ? options.renderActions(row.original) : null}
				</div>
			),
		},
	];
}

function formatDate(value: Date | null) {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return formatInAppTimezone(date, { includeTimezoneWhenDifferent: true });
}
