import { trpc } from "@ecehive/trpc/client";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface InventoryTransactionViewProps {
	userName: string;
	canReturn: boolean; // True if user has items checked out
	onCheckout: (items: { sku: string; quantity: number }[]) => Promise<void>;
	onReturn: (items: { sku: string; quantity: number }[]) => Promise<void>;
	onCancel: () => void;
}

type TransactionItem = {
	id: string;
	name: string;
	sku: string;
	quantity: number;
};

export function InventoryTransactionView({
	userName,
	canReturn,
	onCheckout,
	onReturn,
	onCancel,
}: InventoryTransactionViewProps) {
	const [mode, setMode] = useState<"select" | "checkout" | "return" | null>(
		null,
	);
	const [items, setItems] = useState<TransactionItem[]>([]);
	const [currentSku, setCurrentSku] = useState("");
	const [skuError, setSkuError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const skuInputRef = useRef<HTMLInputElement>(null);

	// Auto-focus SKU input when in transaction mode and capture all keyboard input
	useEffect(() => {
		if (mode === null) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if we're already focused on the input
			if (document.activeElement === skuInputRef.current) return;

			// Ignore if pressing modifier keys alone
			if (e.ctrlKey || e.metaKey || e.altKey) return;

			// Ignore special keys that shouldn't add text
			if (
				e.key === "Tab" ||
				e.key === "Escape" ||
				e.key === "ArrowUp" ||
				e.key === "ArrowDown" ||
				e.key === "ArrowLeft" ||
				e.key === "ArrowRight"
			) {
				return;
			}

			// For any other key, focus the input and let the default behavior happen
			// This handles alphanumeric keys, Enter, Backspace, etc.
			if (skuInputRef.current && e.key.length === 1) {
				skuInputRef.current.focus();
				// The key event will naturally be captured by the now-focused input
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [mode]);

	const handleAddItem = () => {
		if (!currentSku.trim()) return;

		const sku = currentSku.trim().toUpperCase();

		// Check if item already exists using functional state check
		setItems((prevItems) => {
			const existingItem = prevItems.find((item) => item.sku === sku);
			if (existingItem) {
				// Item exists, increment quantity
				return prevItems.map((item) =>
					item.sku === sku ? { ...item, quantity: item.quantity + 1 } : item,
				);
			}
			// Item doesn't exist, we'll fetch it asynchronously
			return prevItems;
		});

		// Check if we need to fetch a new item
		// We need to check outside the state setter for the async operation
		const existingItem = items.find((item) => item.sku === sku);
		if (!existingItem) {
			const id = crypto.randomUUID();

			// Fetch the item name via the tRPC route
			(async () => {
				try {
					const item = await trpc.inventory.items.getBySku.query({ sku });
					if (!item) {
						setSkuError(`Item not found: ${sku}`);
						return;
					}
					if (item.isActive === false) {
						setSkuError("Cannot add inactive item");
						return;
					}
					if (item.name) {
						// Use functional update to avoid stale closure
						setItems((prevItems) => {
							// Double-check the item wasn't added while we were fetching
							if (prevItems.some((i) => i.sku === sku)) {
								return prevItems.map((i) =>
									i.sku === sku ? { ...i, quantity: i.quantity + 1 } : i,
								);
							}
							return [
								...prevItems,
								{
									id,
									name: item.name,
									sku,
									quantity: 1,
								},
							];
						});
						setSkuError(null);
					}
				} catch (err) {
					console.error("Failed to fetch item name", err);
					setSkuError("Failed to fetch item information");
				}
			})();
		}
		setCurrentSku("");
	};

	const handleUpdateQuantity = (id: string, delta: number) => {
		setItems(
			items
				.map((item) =>
					item.id === id
						? { ...item, quantity: Math.max(0, item.quantity + delta) }
						: item,
				)
				.filter((item) => item.quantity > 0),
		);
	};

	const handleRemoveItem = (id: string) => {
		setItems(items.filter((item) => item.id !== id));
	};

	const handleSubmit = async () => {
		if (items.length === 0) return;

		setIsSubmitting(true);
		try {
			const itemsData = items.map((item) => ({
				sku: item.sku,
				quantity: item.quantity,
			}));

			if (mode === "checkout") {
				await onCheckout(itemsData);
			} else if (mode === "return") {
				await onReturn(itemsData);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleBack = () => {
		setMode(null);
		setItems([]);
		setCurrentSku("");
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		>
			<div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-card shadow-2xl">
				<button
					type="button"
					onClick={onCancel}
					className="absolute top-6 right-6 z-10 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
					aria-label="Close"
				>
					<X className="h-6 w-6" />
				</button>

				<div className="p-12">
					<AnimatePresence mode="wait">
						{mode === null ? (
							<motion.div
								key="select"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className="flex flex-col items-center gap-8"
							>
								<div className="text-center">
									<h2 className="text-5xl font-bold mb-4">{userName}</h2>
									<p className="text-2xl text-muted-foreground">
										What would you like to do?
									</p>
								</div>

								<div className="flex gap-6 w-full max-w-2xl">
									<Button
										size="lg"
										className="flex-1 h-32 text-2xl"
										onClick={() => setMode("checkout")}
									>
										Check Out Items
									</Button>
									{canReturn && (
										<Button
											size="lg"
											variant="outline"
											className="flex-1 h-32 text-2xl"
											onClick={() => setMode("return")}
										>
											Return Items
										</Button>
									)}
								</div>
							</motion.div>
						) : (
							<motion.div
								key="transaction"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className="flex flex-col gap-6"
							>
								<div className="text-center">
									<h2 className="text-4xl font-bold mb-2">
										{mode === "checkout" ? "Check Out Items" : "Return Items"}
									</h2>
									<p className="text-xl text-muted-foreground">{userName}</p>
								</div>

								<div className="flex gap-4 items-end">
									<div className="flex-1">
										<Label htmlFor="sku" className="text-lg mb-2">
											Item SKU
										</Label>
										<Input
											ref={skuInputRef}
											id="sku"
											value={currentSku}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
												setCurrentSku(e.target.value);
												setSkuError(null);
											}}
											onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
												if (e.key === "Enter") {
													handleAddItem();
												}
											}}
											placeholder={skuError ?? "Scan or enter SKU..."}
											aria-invalid={!!skuError}
											className={`h-14 text-xl ${
												skuError
													? "border-destructive focus:border-destructive placeholder:text-destructive"
													: ""
											}`}
											autoFocus
										/>
									</div>
									<Button
										size="lg"
										onClick={handleAddItem}
										disabled={!currentSku.trim()}
										className="h-14 px-8 text-lg"
									>
										Add Item
									</Button>
								</div>

								<div className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto">
									{items.length === 0 ? (
										<div className="flex items-center justify-center h-full text-muted-foreground text-lg">
											No items added yet
										</div>
									) : (
										<div className="space-y-3">
											{items.map((item) => (
												<div
													key={item.id}
													className="flex items-center gap-4 p-4 bg-background rounded-lg border"
												>
													<div className="flex-1">
														<p className="font-mono text-xl font-semibold">
															{item.name}
														</p>
													</div>
													<div className="flex items-center gap-2">
														<Button
															size="icon"
															variant="outline"
															onClick={() => handleUpdateQuantity(item.id, -1)}
														>
															<Minus className="h-4 w-4" />
														</Button>
														<span className="text-2xl font-bold w-12 text-center">
															{item.quantity}
														</span>
														<Button
															size="icon"
															variant="outline"
															onClick={() => handleUpdateQuantity(item.id, 1)}
														>
															<Plus className="h-4 w-4" />
														</Button>
													</div>
													<Button
														size="icon"
														variant="ghost"
														onClick={() => handleRemoveItem(item.id)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									)}
								</div>

								<div className="flex gap-4">
									<Button
										size="lg"
										variant="outline"
										onClick={handleBack}
										className="flex-1 h-14 text-lg"
										disabled={isSubmitting}
									>
										Back
									</Button>
									<Button
										size="lg"
										onClick={handleSubmit}
										disabled={items.length === 0 || isSubmitting}
										className="flex-1 h-14 text-lg"
									>
										{isSubmitting
											? "Processing..."
											: mode === "checkout"
												? "Complete Checkout"
												: "Complete Return"}
									</Button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
}
