import {
	CheckCircle2,
	Loader2,
	Maximize,
	Minimize2,
	XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConnectionStatus, KioskStatus } from "@/types";

interface KioskHeaderProps {
	logoUrl: string;
	connectionStatus: ConnectionStatus;
	kioskStatus: KioskStatus;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function KioskHeader({
	logoUrl,
	connectionStatus,
	kioskStatus,
	isFullscreen,
	onToggleFullscreen,
}: KioskHeaderProps) {
	const getStatusConfig = () => {
		switch (connectionStatus) {
			case "connected":
				return {
					icon: CheckCircle2,
					text: "Connected",
					variant: "default" as const,
					className: "bg-green-500 hover:bg-green-600",
				};
			case "connecting":
				return {
					icon: Loader2,
					text: "Connecting...",
					variant: "secondary" as const,
					className: "animate-pulse",
				};
			case "error":
				return {
					icon: XCircle,
					text: "Error",
					variant: "destructive" as const,
					className: "",
				};
			default:
				return {
					icon: XCircle,
					text: "Disconnected",
					variant: "outline" as const,
					className: "",
				};
		}
	};

	const statusConfig = getStatusConfig();
	const StatusIcon = statusConfig.icon;

	return (
		<div className="flex-none px-4 py-3 sm:px-6 sm:py-4">
			<div className="flex items-center justify-between">
				<img src={logoUrl} alt="HUMS" className="h-8 sm:h-10 w-auto" />
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggleFullscreen}
						title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
					>
						{isFullscreen ? (
							<Minimize2 className="h-5 w-5" />
						) : (
							<Maximize className="h-5 w-5" />
						)}
					</Button>
					{!kioskStatus.checking && (
						<Badge
							variant={kioskStatus.isKiosk ? "default" : "destructive"}
							className={`flex items-center gap-2 ${kioskStatus.isKiosk ? "bg-blue-500 hover:bg-blue-600" : ""}`}
						>
							{kioskStatus.isKiosk ? (
								<>
									<CheckCircle2 className="h-4 w-4" />
									<span className="text-sm">Kiosk Registered</span>
								</>
							) : (
								<>
									<XCircle className="h-4 w-4" />
									<span className="text-sm">Not Registered</span>
								</>
							)}
						</Badge>
					)}
					<Badge
						variant={statusConfig.variant}
						className={`flex items-center gap-2 ${statusConfig.className}`}
					>
						<StatusIcon
							className={`h-4 w-4 ${connectionStatus === "connecting" ? "animate-spin" : ""}`}
						/>
						<span className="text-sm">{statusConfig.text}</span>
					</Badge>
				</div>
			</div>
		</div>
	);
}
