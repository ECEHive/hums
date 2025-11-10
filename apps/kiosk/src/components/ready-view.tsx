import { Maximize } from "lucide-react";
import { KioskClock } from "@/components/kiosk-clock";
import { Button } from "@/components/ui/button";

interface ReadyViewProps {
	logoUrl: string;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function ReadyView({
	logoUrl,
	isFullscreen,
	onToggleFullscreen,
}: ReadyViewProps) {
	return (
		<div className="w-full h-full flex items-center justify-center overflow-hidden relative">
			{!isFullscreen && (
				<div className="absolute top-4 right-4 z-40">
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggleFullscreen}
						title="Enter Fullscreen"
					>
						<Maximize className="h-5 w-5" />
					</Button>
				</div>
			)}

			<div className="text-center px-4 py-6 max-h-[85vh] flex flex-col items-center justify-center gap-6 sm:gap-8">
				<img
					src={logoUrl}
					alt="HUMS"
					className="h-[clamp(40px,6vw,96px)] w-auto mx-auto flex-shrink-0"
				/>

				<KioskClock className="text-[clamp(1rem,9vw,10rem)] leading-tight max-w-full" />

				<div className="space-y-2">
					<h1 className="text-[clamp(1.25rem,3.2vw,2.25rem)] font-bold leading-tight">
						Ready to Scan
					</h1>
					<p className="text-[clamp(0.95rem,1.8vw,1.1rem)] text-muted-foreground max-w-[80vw] sm:max-w-[60vw] mx-auto">
						Please scan your card to tap in or out
					</p>
				</div>
			</div>
		</div>
	);
}
