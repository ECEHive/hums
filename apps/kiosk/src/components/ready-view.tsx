import { Maximize } from "lucide-react";
import { KioskClock } from "@/components/kiosk-clock";
import { KioskButton } from "@/components/kiosk-ui";
import { LoadingIndicator } from "@/components/loading-indicator";

interface ReadyViewProps {
	logoUrl: string;
	isFullscreen: boolean;
	isProcessing?: boolean;
	onToggleFullscreen: () => void;
}

export function ReadyView({
	logoUrl,
	isFullscreen,
	isProcessing = false,
	onToggleFullscreen,
}: ReadyViewProps) {
	return (
		<div className="w-full h-full flex items-center justify-center overflow-hidden relative">
			{!isFullscreen && (
				<div
					className="absolute z-40"
					style={{
						top: "calc(1rem * var(--kiosk-scale))",
						right: "calc(1rem * var(--kiosk-scale))",
					}}
				>
					<KioskButton
						variant="ghost"
						onClick={onToggleFullscreen}
						title="Enter Fullscreen"
						style={{
							width: "calc(2.5rem * var(--kiosk-scale))",
							height: "calc(2.5rem * var(--kiosk-scale))",
							padding: 0,
						}}
					>
						<Maximize className="kiosk-icon-md" />
					</KioskButton>
				</div>
			)}

			<div className="text-center kiosk-gap-6 flex flex-col items-center justify-center">
				<img
					src={logoUrl}
					alt="HUMS"
					className="flex-shrink-0"
					style={{
						height: "calc(6rem * var(--kiosk-scale))",
						width: "auto",
					}}
				/>

				<KioskClock className="kiosk-text-9xl leading-tight max-w-full" />

				<div
					className="flex items-center justify-center"
					style={{
						minHeight: "calc(5rem * var(--kiosk-scale))",
					}}
				>
					{isProcessing ? (
						<LoadingIndicator message="Processing..." />
					) : (
						<div className="kiosk-gap-2 flex flex-col">
							<h1 className="kiosk-text-4xl font-bold leading-tight">
								Ready to Scan
							</h1>
							<p className="kiosk-text-xl text-muted-foreground kiosk-max-w-lg mx-auto">
								Please scan your card to tap in or out
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
