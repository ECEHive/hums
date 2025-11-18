import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface LoadingIndicatorProps {
	message?: string;
	className?: string;
}

export function LoadingIndicator({
	message = "Processing...",
	className = "",
}: LoadingIndicatorProps) {
	return (
		<div className={`flex flex-col items-center gap-2 ${className}`}>
			<motion.span
				animate={{ rotate: 360 }}
				transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
				style={{ display: "inline-flex" }}
			>
				<Loader2 className="h-8 w-8 text-primary" />
			</motion.span>
			<p className="text-xl font-semibold text-muted-foreground">
				{message}
			</p>
		</div>
	);
}
