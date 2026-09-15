import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TransactionItem } from "./inventory-transaction-view";

interface ItemListProps {
	items: TransactionItem[];
	handleUpdateQuantity: (itemId: string, delta: number) => void;
	handleRemoveItem: (itemId: string) => void;
	mode: "select" | "checkout" | "return" | "my_checked_out";
}

export function ItemList({
	items,
	handleUpdateQuantity,
	handleRemoveItem,
	mode,
}: ItemListProps) {
	return (
		<div className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
			{items.length === 0 ? (
				<div className="flex items-center justify-center h-full text-muted-foreground text-lg">
					{mode === "my_checked_out"
						? "You have no checked out items"
						: "No items added yet"}
				</div>
			) : (
				<div className="space-y-3">
					{items.map((item) => (
						<div
							key={item.id}
							className="flex items-center gap-4 p-4 bg-background rounded-lg border"
						>
							<div className="flex-1">
								<p className="font-mono text-xl font-semibold">{item.name}</p>
							</div>
							{item.itemType === "single" ? (
								<span className="text-lg text-muted-foreground">
									Individual item
								</span>
							) : (
								<div className="flex items-center gap-2">
									{mode !== "my_checked_out" && (
										<Button
											size="icon"
											variant="outline"
											onClick={() => handleUpdateQuantity(item.id, -1)}
										>
											<Minus className="h-4 w-4" />
										</Button>
									)}
									<span className="text-2xl font-bold w-12 text-center">
										{Math.abs(Number(item.quantity))}
									</span>
									{mode !== "my_checked_out" && (
										<Button
											size="icon"
											variant="outline"
											onClick={() => handleUpdateQuantity(item.id, 1)}
										>
											<Plus className="h-4 w-4" />
										</Button>
									)}
								</div>
							)}
							{mode !== "my_checked_out" && (
								<Button
									size="icon"
									variant="ghost"
									onClick={() => handleRemoveItem(item.id)}
								>
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
