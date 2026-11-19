import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import {
	ClockIcon,
	CookieIcon,
	DoorClosedLockedIcon,
	EllipsisIcon,
	LinkIcon,
	LockIcon,
	PackageIcon,
} from "lucide-react";
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
						{row.itemType === "consumable" ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<CookieIcon className="h-4 w-4 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>
									Consumable item, no return needed
								</TooltipContent>
							</Tooltip>
						) : null}
						{row.itemType === "single" ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<PackageIcon className="h-4 w-4 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>Individual item</TooltipContent>
							</Tooltip>
						) : null}
						{row.transactionRateLimit !== undefined &&
						row.transactionRateLimit !== null ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="ghost" size="icon" className="h-6 w-6">
										<ClockIcon className="h-4 w-4 text-amber-500" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<div className="text-sm">
										<div className="font-semibold mb-1">Transaction Limit</div>
										<div>
											{row.transactionRateLimit}
											{" per "}
											{row.transactionRateLimitPeriod}
										</div>
									</div>
								</TooltipContent>
							</Tooltip>
						) : null}
						{row.inSpaceOnly ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<DoorClosedLockedIcon className="h-4 w-4 text-muted-foreground" />
								</TooltipTrigger>
								<TooltipContent>
									This item is in-space only (requires active session)
								</TooltipContent>
							</Tooltip>
						) : null}
						{row.approvalRoles && row.approvalRoles.length > 0 ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<LockIcon className="h-4 w-4 text-amber-500" />
								</TooltipTrigger>
								<TooltipContent>
									<div className="text-sm">
										<div className="font-semibold mb-1">Restricted Item</div>
										<div>Requires approval from:</div>
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
			id: "sku",
			accessorFn: (row) => row.sku || undefined,
			header: "SKU",
			cell: (info) => info.getValue() ?? "",
		},
		{
			id: "location",
			accessorFn: (row) => row.location || undefined,
			header: "Location",
			cell: (info) => info.getValue() ?? "",
		},
		{
			id: "minQuantity",
			accessorFn: (row) => row.minQuantity ?? undefined,
			header: "Min Qty",
			cell: (info) => info.getValue() ?? "",
		},
		{
			id: "snapshot",
			accessorFn: (row) => row.currentQuantity ?? undefined,
			header: "Quantity",
			cell: (info) => info.getValue() ?? "-",
		},
		{
			id: "created",
			accessorFn: (row) =>
				row.createdAt ? new Date(row.createdAt).getTime() : undefined,
			header: "Created",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				if (!row.createdAt) return "-";
				return `${formatDistanceToNow(new Date(row.createdAt))} ago`;
			},
		},
		{
			id: "updated",
			accessorFn: (row) =>
				row.updatedAt ? new Date(row.updatedAt).getTime() : undefined,
			header: "Updated",
			cell: (info) => {
				const row = info.row.original as ItemRow;
				if (!row.updatedAt) return "-";
				return `${formatDistanceToNow(new Date(row.updatedAt))} ago`;
			},
		},
		{
			id: "actions",
			enableSorting: false,
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
