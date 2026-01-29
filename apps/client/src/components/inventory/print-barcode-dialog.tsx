import { BarcodeIcon } from "lucide-react";
import React from "react";
import type { ItemRow } from "@/components/inventory/types";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type LabelTemplate,
	printBarcodeLabels,
} from "@/lib/inventory/barcode-labels";

interface PrintBarcodeDialogProps {
	items: ItemRow[];
	disabled?: boolean;
}

export function PrintBarcodeDialog({
	items,
	disabled,
}: PrintBarcodeDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [offset, setOffset] = React.useState(0);
	const [template, setTemplate] = React.useState<LabelTemplate>("94200");

	const handlePrint = () => {
		printBarcodeLabels(items, { offset, template });
		setOpen(false);
	};

	const maxOffset = template === "94270" ? 83 : template === "94203" ? 79 : 29;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" disabled={disabled}>
					<BarcodeIcon className="size-4" />
					Print Labels
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Print Barcode Labels</DialogTitle>
					<DialogDescription>
						Configure printing options for {items.length} item(s)
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="template">Label Template</Label>
						<Select
							value={template}
							onValueChange={(value) => setTemplate(value as LabelTemplate)}
						>
							<SelectTrigger id="template">
								<SelectValue />
							</SelectTrigger>
						<SelectContent>
							<SelectItem value="94200">
								Presta 94200 (1" × 2-5/8", 30/sheet)
							</SelectItem>
							<SelectItem value="94203">
								Presta 94203 (1/2" × 1-3/4", 80/sheet)
							</SelectItem>
							<SelectItem value="94270">
								Presta 94270 (1/2" × 1", 84/sheet)
							</SelectItem>
						</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Select your label sheet template
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="offset">Starting Position (Offset)</Label>
						<Input
							id="offset"
							type="number"
							min={0}
							max={maxOffset}
							value={offset}
							onChange={(e) => {
								const value = Number.parseInt(e.target.value, 10);
								if (!Number.isNaN(value) && value >= 0 && value <= maxOffset) {
									setOffset(value);
								}
							}}
						/>
						<p className="text-xs text-muted-foreground">
							Skip the first N labels (0-{maxOffset}) if some stickers are
							already used
						</p>
					</div>

					<div className="rounded-lg border p-3 bg-muted/50 text-sm">
						<p className="font-medium mb-1">Sheet Layout:</p>
						<ul className="space-y-1 text-muted-foreground text-xs">
							{template === "94200" ? (
								<>
									<li>• 30 labels per sheet (3 columns × 10 rows)</li>
									<li>• Label size: 1" × 2-5/8"</li>
									<li>• Sheet size: 8.5" × 11"</li>
									<li>• Presta 94200 compatible template</li>
								</>
							) : template === "94203" ? (
								<>
									<li>• 80 labels per sheet (4 columns × 20 rows)</li>
									<li>• Label size: 1/2" × 1-3/4"</li>
									<li>• Sheet size: 8.5" × 11"</li>
									<li>• Presta 94203 compatible template</li>
								</>
							) : (
								<>
									<li>• 84 labels per sheet (6 columns × 14 rows)</li>
									<li>• Label size: 1/2" × 1"</li>
									<li>• Sheet size: 8.5" × 11"</li>
									<li>• Presta 94270 compatible template</li>
								</>
							)}
						</ul>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handlePrint}>
						<BarcodeIcon className="size-4" />
						Print Labels
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
