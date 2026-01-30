import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { EllipsisIcon, LinkIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteDialog } from "./delete-dialog";
import { EditDialog } from "./edit-dialog";
import type { ItemRow } from "./types";

export function generateColumns(): ColumnDef<ItemRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Name",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				const handleCopyLink = async () => {
					if (row.link) {
						try {
							await navigator.clipboard.writeText(row.link);
							toast.success("Link copied to clipboard");
						} catch {
							toast.error("Failed to copy link");
						}
					}
				};

				return (
					<div className="flex items-center gap-2">
						<span>{info.getValue() as string}</span>
						{row.link ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={handleCopyLink}
									>
										<LinkIcon className="h-4 w-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Copy link to clipboard</TooltipContent>
							</Tooltip>
						) : null}
						{row.approvalRoles && row.approvalRoles.length > 0 ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center">
										<LockIcon className="h-4 w-4 text-amber-500" />
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<div className="text-sm">
										<div className="font-semibold mb-1">Restricted Item</div>
										<div className="text-muted-foreground">
											Requires approval from:
										</div>
										<ul className="mt-1 list-disc list-inside">
											{row.approvalRoles.map((role) => (
												<li key={role.id}>{role.name}</li>
											))}
										</ul>
									</div>
								</TooltipContent>
							</Tooltip>
						) : null}
						{row.description ? (
							<Tooltip>
								<TooltipTrigger>
									<EllipsisIcon className="h-4 w-4 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>{row.description}</TooltipContent>
							</Tooltip>
						) : null}
					</div>
				);
			},
		},
		{
			accessorKey: "sku",
			header: "SKU",
			cell: (info) => info.getValue() ?? "",
		},
		{
			accessorKey: "location",
			header: "Location",
			cell: (info) => info.getValue() ?? "",
		},
		{
			accessorKey: "minQuantity",
			header: "Min Qty",
			cell: (info) => info.getValue() ?? "",
		},
		{
			id: "snapshot",
			header: "Quantity",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				if (row.currentQuantity !== undefined && row.currentQuantity !== null) {
					return row.currentQuantity;
				}
				return "-";
			},
		},
		{
			id: "created",
			header: "Created",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				if (!row.createdAt) return "-";
				return `${formatDistanceToNow(new Date(row.createdAt))} ago`;
			},
		},
		{
			id: "updated",
			header: "Updated",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				if (!row.updatedAt) return "-";
				return `${formatDistanceToNow(new Date(row.updatedAt))} ago`;
			},
		},
		{
			id: "actions",
			header: "",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				return (
					<div className="flex items-center gap-2 justify-end">
						{/* Edit */}
						<EditDialog item={row} />
						{/* Delete */}
						<DeleteDialog item={row} />
					</div>
				);
			},
		},
	];
}
