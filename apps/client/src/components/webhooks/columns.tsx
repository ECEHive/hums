import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatInAppTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { WebhookEndpointRow } from "./types";

export function createWebhookEndpointColumns(options: {
	renderActions?: (webhookEndpoint: WebhookEndpointRow) => ReactNode;
	canEditPermissions?: boolean;
}): ColumnDef<WebhookEndpointRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<div className="space-y-1 font-medium">{row.original.name}</div>
			),
		},
		{
			accessorKey: "url",
			header: "URL",
			cell: ({ row }) => (
				<Tooltip>
					<TooltipTrigger asChild>
						<code className="rounded bg-muted px-2 py-1 text-xs">
							{row.original.url.match(
								/^(?:https?:\/\/)?(?:www\.)?([^/\n?]+)/,
							)?.[1] || row.original.url}
						</code>
					</TooltipTrigger>
					<TooltipContent>{row.original.url}</TooltipContent>
				</Tooltip>
			),
		},
		{
			accessorKey: "isActive",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={!row.original.isActive ? "destructive" : "secondary"}
					className={cn("gap-1", !row.original.isActive && "bg-destructive/10")}
				>
					{row.original.isActive ? "Active" : "Inactive"}
				</Badge>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
		},
		{
			accessorKey: "updatedAt",
			header: "Updated",
			cell: ({ row }) => <span>{formatDate(row.original.updatedAt)}</span>,
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
