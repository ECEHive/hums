import type { ColumnDef } from "@tanstack/react-table";
import { PackageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type ItemHolder = {
	userId: number;
	name: string;
	username: string;
	quantity: number;
};

type TransactionSummary = {
	itemId: string;
	itemName: string;
	itemSku: string | null;
	itemType: string;
	netQuantity: number;
	checkedOutBy: ItemHolder[];
};

const MAX_VISIBLE_HOLDERS = 3;

function HolderLine({
	holder,
	showQuantity,
}: {
	holder: ItemHolder;
	showQuantity: boolean;
}) {
	return (
		<div className="flex items-baseline gap-1.5">
			<span className="font-medium">{holder.name}</span>
			<span className="text-xs text-muted-foreground">{holder.username}</span>
			{showQuantity && (
				<span className="text-xs text-muted-foreground">
					×{holder.quantity}
				</span>
			)}
		</div>
	);
}

function CheckedOutByCell({
	holders,
	isSingle,
}: {
	holders: ItemHolder[];
	isSingle: boolean;
}) {
	if (holders.length === 0) {
		return <span className="text-muted-foreground">—</span>;
	}

	const visible = holders.slice(0, MAX_VISIBLE_HOLDERS);
	const hiddenCount = holders.length - visible.length;

	return (
		<div className="flex flex-col gap-0.5">
			{visible.map((holder) => (
				<HolderLine
					key={holder.userId}
					holder={holder}
					showQuantity={!isSingle}
				/>
			))}
			{hiddenCount > 0 && (
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
						>
							+{hiddenCount} more
						</button>
					</PopoverTrigger>
					<PopoverContent className="max-h-80 overflow-y-auto">
						<div className="flex flex-col gap-1 text-sm">
							{holders.map((holder) => (
								<HolderLine
									key={holder.userId}
									holder={holder}
									showQuantity={!isSingle}
								/>
							))}
						</div>
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}

type MyTransactionSummary = {
	itemId: string;
	itemName: string;
	itemSku: string | null;
	itemType: string;
	netQuantity: number;
};

export function generateSummaryColumns(): ColumnDef<TransactionSummary>[] {
	return [
		{
			accessorKey: "itemName",
			header: "Item",
			cell: ({ row }) => {
				const item = row.original;
				return (
					<div className="flex flex-col">
						<span className="flex items-center gap-2 font-medium">
							{item.itemName}
							{item.itemType === "single" && (
								<Tooltip>
									<TooltipTrigger asChild>
										<PackageIcon className="h-4 w-4 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent>Individual item</TooltipContent>
								</Tooltip>
							)}
						</span>
						{item.itemSku && (
							<span className="text-xs text-muted-foreground">
								{item.itemSku}
							</span>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "netQuantity",
			header: "Net Balance",
			cell: ({ row }) => {
				const quantity = row.original.netQuantity;
				const isSingle = row.original.itemType === "single";

				if (isSingle) {
					return (
						<div className="flex items-center gap-2">
							<Badge
								variant={quantity < 0 ? "default" : "secondary"}
								className={
									quantity < 0
										? "bg-blue-600 text-white"
										: "bg-green-600 text-black"
								}
							>
								{quantity < 0 ? "Checked Out" : "Available"}
							</Badge>
						</div>
					);
				}

				return (
					<div className="flex items-center gap-2">
						<span
							className={`text-lg font-semibold ${
								quantity < 0
									? "text-blue-600"
									: quantity > 0
										? "text-green-600"
										: "text-muted-foreground"
							}`}
						>
							{quantity < 0 ? quantity : `+${quantity}`}
						</span>
						<Badge
							variant={quantity < 0 ? "default" : "secondary"}
							className={
								quantity < 0
									? "bg-blue-600 text-white"
									: "bg-green-600 text-black"
							}
						>
							{quantity < 0 ? "Checked Out" : "Available"}
						</Badge>
					</div>
				);
			},
		},
		{
			id: "checkedOutBy",
			header: "Checked Out By",
			cell: ({ row }) => (
				<CheckedOutByCell
					holders={row.original.checkedOutBy}
					isSingle={row.original.itemType === "single"}
				/>
			),
		},
	];
}

export function generateMySummaryColumns(): ColumnDef<MyTransactionSummary>[] {
	return [
		{
			accessorKey: "itemName",
			header: "Item",
			cell: ({ row }) => {
				const item = row.original;
				return (
					<div className="flex flex-col">
						<span className="flex items-center gap-2 font-medium">
							{item.itemName}
							{item.itemType === "single" && (
								<Tooltip>
									<TooltipTrigger asChild>
										<PackageIcon className="h-4 w-4 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent>Individual item</TooltipContent>
								</Tooltip>
							)}
						</span>
						{item.itemSku && (
							<span className="text-xs text-muted-foreground">
								{item.itemSku}
							</span>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "netQuantity",
			header: "Net Balance",
			cell: ({ row }) => {
				const quantity = row.original.netQuantity;
				const isSingle = row.original.itemType === "single";

				if (isSingle) {
					return (
						<div className="flex items-center gap-2">
							<Badge
								variant={quantity < 0 ? "default" : "secondary"}
								className={
									quantity < 0
										? "bg-blue-600 text-white"
										: "bg-green-600 text-black"
								}
							>
								{quantity < 0 ? "Checked Out" : "In Possession"}
							</Badge>
						</div>
					);
				}

				return (
					<div className="flex items-center gap-2">
						<span
							className={`text-lg font-semibold ${
								quantity < 0
									? "text-blue-600"
									: quantity > 0
										? "text-green-600"
										: "text-muted-foreground"
							}`}
						>
							{quantity < 0 ? quantity : `+${quantity}`}
						</span>
						<Badge
							variant={quantity < 0 ? "default" : "secondary"}
							className={
								quantity < 0
									? "bg-blue-600 text-white"
									: "bg-green-600 text-black"
							}
						>
							{quantity < 0 ? "Checked Out" : "In Possession"}
						</Badge>
					</div>
				);
			},
		},
	];
}
