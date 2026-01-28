import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpIcon, InfoIcon, Loader2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";

interface ImportCsvDialogProps {
	onImportComplete?: () => void;
}

export function ImportCsvDialog({ onImportComplete }: ImportCsvDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [file, setFile] = React.useState<File | null>(null);
	const [dragActive, setDragActive] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	const importMutation = useMutation({
		mutationFn: async (csvContent: string) => {
			return await trpc.inventory.items.importCsv.mutate({ csvContent });
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
			
			let message = `Successfully imported ${data.createdCount} item(s)`;
			if (data.failedCount > 0) {
				message += `. ${data.failedCount} item(s) failed.`;
			}
			
			toast.success(message);
			
			if (data.failed.length > 0) {
				const failedDetails = data.failed
					.map((f) => `${f.name}: ${f.error}`)
					.join("\n");
				toast.error(`Failed imports:\n${failedDetails}`, {
					duration: 10000,
				});
			}
			
			setOpen(false);
			setFile(null);
			onImportComplete?.();
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to import CSV");
		},
	});

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (e.dataTransfer.files?.[0]) {
			const droppedFile = e.dataTransfer.files[0];
			if (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv")) {
				setFile(droppedFile);
			} else {
				toast.error("Please upload a CSV file");
			}
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files?.[0]) {
			setFile(e.target.files[0]);
		}
	};

	const handleImport = async () => {
		if (!file) {
			toast.error("Please select a CSV file");
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e) => {
			const csvContent = e.target?.result as string;
			importMutation.mutate(csvContent);
		};
		reader.onerror = () => {
			toast.error("Failed to read file");
		};
		reader.readAsText(file);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<FileUpIcon className="size-4" />
					Import CSV
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Import Items from CSV</DialogTitle>
					<DialogDescription>
						Upload a CSV file to bulk import inventory items
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Information Section */}
					<div className="rounded-lg border bg-muted/50 p-4">
						<div className="flex gap-2">
							<InfoIcon className="size-5 shrink-0 text-muted-foreground mt-0.5" />
							<div className="space-y-2 text-sm">
								<p className="font-semibold">CSV Format Requirements:</p>
								<ul className="space-y-1 list-disc list-inside text-muted-foreground">
									<li>
										<strong>Required column:</strong> name (case-insensitive)
									</li>
									<li>
										<strong>Optional columns:</strong> description, sku, location,
										minQuantity, initialQuantity, isActive
									</li>
									<li>Header row is required</li>
									<li>Column names are case-insensitive</li>
									<li>
										If SKU is not provided, it will be auto-generated (8-character
										alphanumeric code)
									</li>
									<li>
										initialQuantity sets the starting inventory snapshot quantity
									</li>
									<li>
										isActive accepts: true/false, 1/0, yes/no, y/n (defaults to
										true)
									</li>
								</ul>
								<p className="mt-2 text-xs text-muted-foreground">
									<strong>Example header:</strong> name,description,sku,location,minQuantity,initialQuantity,isActive
								</p>
							</div>
						</div>
					</div>

					{/* File Upload Area */}
					<div className="space-y-2">
						<Label>CSV File</Label>
						<button
							type="button"
							className={`relative w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
								dragActive
									? "border-primary bg-primary/5"
									: "border-muted-foreground/25 hover:border-muted-foreground/50"
							}`}
							onDragEnter={handleDrag}
							onDragLeave={handleDrag}
							onDragOver={handleDrag}
							onDrop={handleDrop}
							onClick={() => !file && fileInputRef.current?.click()}
						>
							<input
								ref={fileInputRef}
								type="file"
								accept=".csv"
								onChange={handleFileChange}
								className="hidden"
							/>

							{file ? (
								<div className="space-y-2">
									<FileUpIcon className="mx-auto size-8 text-primary" />
									<p className="font-medium">{file.name}</p>
									<p className="text-sm text-muted-foreground">
										{(file.size / 1024).toFixed(2)} KB
									</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setFile(null);
											if (fileInputRef.current) {
												fileInputRef.current.value = "";
											}
										}}
									>
										Remove
									</Button>
								</div>
							) : (
								<div className="space-y-2">
									<FileUpIcon className="mx-auto size-8 text-muted-foreground" />
									<div>
										<p className="font-medium">
											Drop your CSV file here, or click to browse
										</p>
										<p className="text-sm text-muted-foreground">
											CSV files only
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => fileInputRef.current?.click()}
									>
										Select File
									</Button>
								</div>
							)}
						</button>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => {
							setOpen(false);
							setFile(null);
						}}
						disabled={importMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleImport}
						disabled={!file || importMutation.isPending}
					>
						{importMutation.isPending ? (
							<>
								<Loader2Icon className="size-4 animate-spin" />
								Importing...
							</>
						) : (
							<>
								<FileUpIcon className="size-4" />
								Import Items
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
