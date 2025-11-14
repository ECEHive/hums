import { Loader2 } from "lucide-react";

interface LoadingIndicatorProps {
	message?: string;
	className?: string;
}

export function LoadingIndicator({
	message = "Processing...",
	className = "",
}: LoadingIndicatorProps) {
	return (
		<div className={`flex flex-col items-center kiosk-gap-2 ${className}`}>
			<Loader2 className="kiosk-icon-lg animate-spin text-primary" />
			<p className="kiosk-text-xl font-semibold text-muted-foreground">
				{message}
			</p>
		</div>
	);
}
