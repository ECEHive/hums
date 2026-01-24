import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { EllipsisIcon } from "lucide-react";
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
				return (
					<div className="flex items-center gap-2">
						<span>{info.getValue() as string}</span>
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
				return row.snapshot?.quantity ?? "-";
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
