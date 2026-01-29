import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

type TransactionSummary = {
	itemId: string;
	itemName: string;
	itemSku: string | null;
	netQuantity: number;
};

type MyTransactionSummary = {
	itemId: string;
	itemName: string;
	itemSku: string | null;
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
						<span className="font-medium">{item.itemName}</span>
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
									? "bg-blue-600 hover:bg-blue-700 text-foreground"
									: "bg-green-600 hover:bg-green-700 text-foreground"
							}
						>
							{quantity < 0 ? "Checked Out" : "Available"}
						</Badge>
					</div>
				);
			},
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
						<span className="font-medium">{item.itemName}</span>
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
									? "bg-blue-600 hover:bg-blue-700 text-foreground"
									: "bg-green-600 hover:bg-green-700 text-foreground"
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
