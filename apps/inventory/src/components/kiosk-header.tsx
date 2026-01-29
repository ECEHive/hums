import {
	CheckCircle2,
	Loader2,
	Maximize,
	Minimize2,
	XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { getLogoDataUrl, useBranding } from "@/hooks/useBranding";
import type { ConnectionStatus, KioskStatus } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface KioskHeaderProps {
	connectionStatus: ConnectionStatus;
	kioskStatus: KioskStatus;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function KioskHeader({
	connectionStatus,
	kioskStatus,
	isFullscreen,
	onToggleFullscreen,
}: KioskHeaderProps) {
	const { data: branding } = useBranding();
	const getStatusConfig = () => {
		switch (connectionStatus) {
			case "connected":
				return {
					icon: CheckCircle2,
					text: "Connected",
					variant: "default" as const,
					className: "bg-green-500 hover:bg-green-600",
					pulse: false,
					spin: false,
				};
			case "connecting":
				return {
					icon: Loader2,
					text: "Connecting...",
					variant: "secondary" as const,
					className: "",
					pulse: true,
					spin: true,
				};
			case "error":
				return {
					icon: XCircle,
					text: "Error",
					variant: "destructive" as const,
					className: "",
					pulse: false,
					spin: false,
				};
			default:
				return {
					icon: XCircle,
					text: "Disconnected",
					variant: "outline" as const,
					className: "",
					pulse: false,
					spin: false,
				};
		}
	};

	const statusConfig = getStatusConfig();
	const StatusIcon = statusConfig.icon;

	// Dark mode kiosks use dark logo
	const logoSrc = branding ? getLogoDataUrl(branding.logos.dark) : undefined;

	return (
		<div className="flex-none">
			<div className="flex items-center justify-between gap-4">
				{logoSrc && <img src={logoSrc} alt="Logo" className="w-24 h-auto" />}
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
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
									Inventory Enabled
								</>
							) : (
								<>
									<XCircle className="h-4 w-4" />
									No Inventory Access
								</>
							)}
						</Badge>
					)}
					<motion.div
						className="flex"
						animate={
							statusConfig.pulse
								? { scale: [1, 0.98, 1], opacity: [1, 0.7, 1] }
								: { scale: 1, opacity: 1 }
						}
						transition={
							statusConfig.pulse
								? { duration: 1, repeat: Infinity, ease: "easeInOut" }
								: { duration: 0 }
						}
					>
						<Badge
							variant={statusConfig.variant}
							className={`flex items-center gap-2 ${statusConfig.className}`}
						>
							<motion.span
								animate={statusConfig.spin ? { rotate: 360 } : { rotate: 0 }}
								transition={
									statusConfig.spin
										? { repeat: Infinity, duration: 1, ease: "linear" }
										: { duration: 0 }
								}
								style={{ display: "flex" }}
							>
								<StatusIcon className="h-4 w-4" />
							</motion.span>
							<span>{statusConfig.text}</span>
						</Badge>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
