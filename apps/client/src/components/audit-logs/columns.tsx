import type { ColumnDef } from "@tanstack/react-table";
import { HatGlassesIcon, UserCogIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AuditLogRow } from "./types";
import {
	formatActor,
	formatAuditLogApiTokenPrimary,
	formatDateTime,
} from "./utils";

export type CreateAuditLogColumnsOptions = {
	onInspect?: (log: AuditLogRow) => void;
	renderTimestampExtra?: (log: AuditLogRow) => ReactNode;
};

export function createAuditLogColumns(
	options: CreateAuditLogColumnsOptions = {},
): ColumnDef<AuditLogRow>[] {
	const { onInspect, renderTimestampExtra } = options;

	return [
		{
			accessorKey: "createdAt",
			header: "Timestamp",
			cell: ({ row }) => (
				<div className="space-y-0.5">
					<span className="whitespace-nowrap font-medium">
						{formatDateTime(row.original.createdAt)}
					</span>
					{renderTimestampExtra ? (
						<div className="text-xs text-muted-foreground">
							{renderTimestampExtra(row.original)}
						</div>
					) : null}
				</div>
			),
		},
		{
			id: "actor",
			header: "Actor",
			cell: ({ row }) => <ActorCell log={row.original} />,
		},
		{
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => (
				<code className="text-xs font-semibold tracking-tight">
					{row.original.action}
				</code>
			),
		},
		{
			accessorKey: "source",
			header: "Source",
			cell: ({ row }) => (
				<Badge variant="secondary">{row.original.source}</Badge>
			),
			meta: { className: "w-[120px]" },
		},
		{
			id: "inspect",
			header: () => <span className="sr-only">Inspect</span>,
			cell: ({ row }) => (
				<div className="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={(event) => {
							event.stopPropagation();
							onInspect?.(row.original);
						}}
					>
						Inspect
					</Button>
				</div>
			),
			meta: { className: "w-[110px]" },
		},
	];
}

function ActorCell({ log }: { log: AuditLogRow }) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-1 text-sm font-semibold">
				{log.impersonatedBy ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<HatGlassesIcon className="size-3 text-amber-500" />
						</TooltipTrigger>
						<TooltipContent>
							Impersonated by {formatActor(log.impersonatedBy)}
						</TooltipContent>
					</Tooltip>
				) : null}
				{log.apiToken ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<UserCogIcon className="size-3 text-amber-500" />
						</TooltipTrigger>
						<TooltipContent>
							API token {formatAuditLogApiTokenPrimary(log.apiToken)}
						</TooltipContent>
					</Tooltip>
				) : null}
				<span>{formatActor(log.user) ?? "System"}</span>
			</div>
		</div>
	);
}
