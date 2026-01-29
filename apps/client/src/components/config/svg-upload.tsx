import { ImageIcon, UploadIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface SvgUploadProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

/**
 * SVG upload component for configuration fields.
 * Supports file upload and displays a preview of the current SVG.
 */
export function SvgUpload({ value, onChange, disabled }: SvgUploadProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editValue, setEditValue] = useState(value);
	const [error, setError] = useState<string | null>(null);

	const handleFileChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			// Validate file type
			if (!file.type.includes("svg") && !file.name.endsWith(".svg")) {
				setError("Please upload an SVG file");
				return;
			}

			try {
				const text = await file.text();

				// Basic SVG validation
				if (!text.includes("<svg") || !text.includes("</svg>")) {
					setError("Invalid SVG file");
					return;
				}

				// Clean up SVG - extract just the SVG content
				const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
				if (svgMatch) {
					setError(null);
					onChange(svgMatch[0]);
				} else {
					setError("Could not extract SVG content");
				}
			} catch {
				setError("Failed to read file");
			}

			// Reset the input
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		},
		[onChange],
	);

	const handleSaveEdit = useCallback(() => {
		// Validate SVG
		if (!editValue.includes("<svg") || !editValue.includes("</svg>")) {
			setError("Invalid SVG content - must contain <svg> tags");
			return;
		}

		// Extract just the SVG content
		const svgMatch = editValue.match(/<svg[\s\S]*<\/svg>/i);
		if (svgMatch) {
			setError(null);
			onChange(svgMatch[0]);
			setIsDialogOpen(false);
		} else {
			setError("Could not extract SVG content");
		}
	}, [editValue, onChange]);

	const handleDialogOpen = useCallback(
		(open: boolean) => {
			setIsDialogOpen(open);
			if (open) {
				setEditValue(value);
				setError(null);
			}
		},
		[value],
	);

	// Create a safe data URL for preview
	const svgDataUrl = value
		? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(value)))}`
		: null;

	return (
		<div className="space-y-3">
			{/* Preview */}
			<div className="border rounded-lg p-4 bg-muted/30">
				{svgDataUrl ? (
					<div className="flex items-center justify-center">
						<img
							src={svgDataUrl}
							alt="SVG Preview"
							className="max-h-24 max-w-full object-contain"
						/>
					</div>
				) : (
					<div className="flex items-center justify-center h-24 text-muted-foreground">
						<ImageIcon className="h-8 w-8 mr-2" />
						<span>No SVG uploaded</span>
					</div>
				)}
			</div>

			{/* Actions */}
			<div className="flex items-center gap-2">
				<input
					ref={fileInputRef}
					type="file"
					accept=".svg,image/svg+xml"
					onChange={handleFileChange}
					disabled={disabled}
					className="hidden"
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => fileInputRef.current?.click()}
					disabled={disabled}
				>
					<UploadIcon className="h-4 w-4 mr-2" />
					Upload SVG
				</Button>

				<Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
					<DialogTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={disabled}
						>
							Edit SVG Code
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-3xl max-h-[80vh]">
						<DialogHeader>
							<DialogTitle>Edit SVG Code</DialogTitle>
							<DialogDescription>
								Edit the SVG content directly. Make sure to include valid SVG
								markup.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							{/* Preview in dialog */}
							{editValue && (
								<div className="border rounded-lg p-4 bg-muted/30">
									<img
										src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(editValue)))}`}
										alt="SVG Preview"
										className="max-h-32 max-w-full object-contain mx-auto"
										onError={() => setError("Invalid SVG preview")}
									/>
								</div>
							)}

							<Textarea
								value={editValue}
								onChange={(e) => {
									setEditValue(e.target.value);
									setError(null);
								}}
								placeholder="<svg>...</svg>"
								className="font-mono text-xs min-h-[200px]"
								disabled={disabled}
							/>

							{error && <p className="text-sm text-destructive">{error}</p>}

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="button"
									onClick={handleSaveEdit}
									disabled={disabled}
								>
									Save Changes
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{error && !isDialogOpen && (
				<p className="text-sm text-destructive">{error}</p>
			)}
		</div>
	);
}
