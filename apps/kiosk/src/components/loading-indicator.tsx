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
		<div className={`flex flex-col items-center gap-4 ${className}`}>
			<Loader2 className="h-16 w-16 animate-spin text-primary" />
			<p className="text-[clamp(1rem,2vw,1.25rem)] font-semibold text-muted-foreground">
				{message}
			</p>
		</div>
	);
}
