import { Maximize } from "lucide-react";
import { KioskClock } from "@/components/kiosk-clock";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Button } from "./ui/button";

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
		<div className="min-w-full h-full flex items-center justify-center overflow-hidden relative">
			{!isFullscreen && (
				<div className="absolute z-40 top-0 right-4">
					<Button
						variant="ghost"
						onClick={onToggleFullscreen}
						title="Enter Fullscreen"
					>
						<Maximize className="w-15 h-15" />
					</Button>
				</div>
			)}

			<div className="flex flex-col items-center justify-center gap-16">
				<div className="w-full flex flex-row items-center justify-center gap-4">
					<p className="text-6xl font-semibold">Hi, welcome to</p>
					<img src={logoUrl} alt="HUMS" className="h-12 w-auto" />
				</div>

				<KioskClock className="text-[10rem]" />

				<div className="flex items-center justify-center">
					{isProcessing ? (
						<LoadingIndicator message="Processing..." />
					) : (
						<p className="text-2xl text-muted-foreground">Tap your BuzzCard</p>
					)}
				</div>
			</div>
		</div>
	);
}
