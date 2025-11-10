import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorDialogProps {
	message: string;
	isExiting: boolean;
}

export function ErrorDialog({ message, isExiting }: ErrorDialogProps) {
	return (
		<div
			className={`absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md transition-opacity duration-300 ${
				isExiting ? "opacity-0" : "opacity-100 animate-in fade-in"
			}`}
		>
			<div
				className={`w-full max-w-2xl mx-4 transition-all duration-500 ${
					isExiting
						? "scale-95 opacity-0 translate-y-4"
						: "scale-100 opacity-100 translate-y-0 animate-in zoom-in-95 slide-in-from-bottom-4"
				}`}
			>
				<Card className="border-8 border-destructive shadow-2xl transition-colors duration-300">
					<CardContent className="flex flex-col items-center gap-8 py-16">
						<div className="relative">
							<AlertCircle className="h-32 w-32 text-destructive animate-in zoom-in-50 duration-700" />
							<div className="absolute inset-0 animate-ping">
								<AlertCircle className="h-32 w-32 text-destructive opacity-40" />
							</div>
						</div>
						<div className="text-center space-y-3 animate-in slide-in-from-bottom-2 duration-500 delay-200">
							<h2 className="text-5xl font-bold text-destructive">Error</h2>
							<p className="text-3xl font-semibold">{message}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
