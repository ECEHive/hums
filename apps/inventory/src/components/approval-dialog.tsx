import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";

export type RestrictedItem = {
	id: string;
	name: string;
	sku: string;
	quantity: number;
	approvalRoles: { id: number; name: string }[];
};

interface ApprovalDialogProps {
	restrictedItems: RestrictedItem[];
	transactionType: "checkout" | "return";
	isProcessing: boolean;
	approverName?: string;
	error?: string;
	onCancel: () => void;
}

export function ApprovalDialog({
	restrictedItems,
	transactionType,
	isProcessing,
	approverName,
	error,
	onCancel,
}: ApprovalDialogProps) {
	// Collect all unique role names that can approve
	const allRoles = new Set<string>();
	for (const item of restrictedItems) {
		for (const role of item.approvalRoles) {
			allRoles.add(role.name);
		}
	}

	return (
		<motion.div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className="relative w-full max-w-2xl mx-8 bg-card rounded-3xl p-8 shadow-2xl"
				initial={{ opacity: 0, scale: 0.95, y: 16 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: 16 }}
				transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			>
				<button
					type="button"
					onClick={onCancel}
					className="absolute top-6 right-6 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
					aria-label="Cancel"
					disabled={isProcessing}
				>
					<X className="h-6 w-6" />
				</button>

				<div className="flex flex-col items-center gap-6">
					<div className="flex items-center justify-center">
						<AlertTriangle className="w-20 h-20 text-yellow-500" />
					</div>

					<div className="text-center">
						<h2 className="text-3xl font-bold mb-2">Approval Required</h2>
						<p className="text-lg text-muted-foreground">
							The following items require supervisor approval to{" "}
							{transactionType === "checkout" ? "check out" : "return"}
						</p>
					</div>

					<div className="w-full border rounded-lg p-4 max-h-[200px] overflow-y-auto">
						<div className="space-y-2">
							{restrictedItems.map((item) => (
								<div
									key={item.id}
									className="flex items-center justify-between p-3 bg-background rounded-lg border"
								>
									<div className="flex-1">
										<p className="font-semibold">{item.name}</p>
										<p className="text-sm text-muted-foreground">
											SKU: {item.sku} • Qty: {item.quantity}
										</p>
									</div>
									<div className="text-xs text-muted-foreground text-right">
										{item.approvalRoles.map((r) => r.name).join(", ")}
									</div>
								</div>
							))}
						</div>
					</div>

					{error ? (
						<div className="w-full p-4 bg-destructive/10 border border-destructive rounded-lg">
							<p className="text-destructive text-center">{error}</p>
						</div>
					) : approverName ? (
						<div className="w-full p-4 bg-green-500/10 border border-green-500 rounded-lg">
							<div className="flex items-center justify-center gap-2 text-green-500">
								<ShieldCheck className="w-6 h-6" />
								<p className="text-lg font-semibold">
									Approved by {approverName}
								</p>
							</div>
						</div>
					) : (
						<div className="w-full">
							<div className="text-center mb-4">
								<p className="text-xl font-semibold">
									{isProcessing
										? "Verifying..."
										: "Scan approver's BuzzCard"}
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									Authorized roles: {Array.from(allRoles).join(", ")}
								</p>
							</div>

							{isProcessing && (
								<div className="flex justify-center">
									<div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
								</div>
							)}
						</div>
					)}

					<Button
						variant="outline"
						size="lg"
						className="w-full h-14 text-lg"
						onClick={onCancel}
						disabled={isProcessing}
					>
						Cancel Transaction
					</Button>
				</div>
			</motion.div>
		</motion.div>
	);
}
