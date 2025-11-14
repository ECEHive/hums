import { AlertCircle } from "lucide-react";
import { KioskCard } from "@/components/kiosk-ui";

interface ErrorDialogProps {
	message: string;
	isExiting: boolean;
}

export function ErrorDialog({ message, isExiting }: ErrorDialogProps) {
	return (
		<div
			className={`absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300 ${
				isExiting ? "opacity-0" : "opacity-100 animate-in fade-in"
			}`}
		>
			<div
				className={`kiosk-max-w-2xl mx-auto transition-all duration-500 ${
					isExiting
						? "scale-95 opacity-0 translate-y-4"
						: "scale-100 opacity-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4"
				}`}
				style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
			>
				<KioskCard
					className="border-destructive shadow-2xl transition-colors duration-300"
					style={{
						borderWidth: "calc(8px * var(--kiosk-scale))",
						padding: "calc(4rem * var(--kiosk-scale))",
					}}
				>
					<div className="flex flex-col items-center kiosk-gap-8">
						<div className="relative">
							<AlertCircle className="kiosk-icon-3xl text-destructive animate-in zoom-in-50 duration-700" />
							<div className="absolute inset-0 animate-ping">
								<AlertCircle className="kiosk-icon-3xl text-destructive opacity-40" />
							</div>
						</div>
						<div className="text-center kiosk-gap-3 flex flex-col animate-in slide-in-from-bottom-2 duration-500 delay-200">
							<h2 className="kiosk-text-6xl font-bold text-destructive">
								Error
							</h2>
							<p className="kiosk-text-4xl font-semibold">{message}</p>
						</div>
					</div>
				</KioskCard>
			</div>
		</div>
	);
}
