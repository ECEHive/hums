import {
	CheckCircle2,
	Loader2,
	Maximize,
	Minimize2,
	XCircle,
} from "lucide-react";
import { KioskBadge, KioskButton } from "@/components/kiosk-ui";
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
		<div
			className="flex-none"
			style={{
				padding: `calc(0.75rem * var(--kiosk-scale)) calc(1.5rem * var(--kiosk-scale))`,
			}}
		>
			<div className="flex items-center justify-between kiosk-gap-4">
				<img
					src={logoUrl}
					alt="HUMS"
					style={{
						height: "calc(2.5rem * var(--kiosk-scale))",
						width: "auto",
					}}
				/>
				<div className="flex items-center kiosk-gap-3">
					<KioskButton
						variant="ghost"
						onClick={onToggleFullscreen}
						title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
						style={{
							width: "calc(2.5rem * var(--kiosk-scale))",
							height: "calc(2.5rem * var(--kiosk-scale))",
							padding: 0,
						}}
					>
						{isFullscreen ? (
							<Minimize2 className="kiosk-icon-md" />
						) : (
							<Maximize className="kiosk-icon-md" />
						)}
					</KioskButton>
					{!kioskStatus.checking && (
						<KioskBadge
							variant={kioskStatus.isKiosk ? "default" : "destructive"}
							className={`flex items-center kiosk-gap-2 ${kioskStatus.isKiosk ? "bg-blue-500 hover:bg-blue-600" : ""}`}
							style={{
								fontSize: "calc(0.875rem * var(--kiosk-scale))",
								padding:
									"calc(0.25rem * var(--kiosk-scale)) calc(0.75rem * var(--kiosk-scale))",
							}}
						>
							{kioskStatus.isKiosk ? (
								<>
									<CheckCircle2 className="kiosk-icon-sm" />
									<span>Kiosk Registered</span>
								</>
							) : (
								<>
									<XCircle className="kiosk-icon-sm" />
									<span>Not Registered</span>
								</>
							)}
						</KioskBadge>
					)}
					<KioskBadge
						variant={statusConfig.variant}
						className={`flex items-center kiosk-gap-2 ${statusConfig.className}`}
						style={{
							fontSize: "calc(0.875rem * var(--kiosk-scale))",
							padding:
								"calc(0.25rem * var(--kiosk-scale)) calc(0.75rem * var(--kiosk-scale))",
						}}
					>
						<StatusIcon
							className={`kiosk-icon-sm ${connectionStatus === "connecting" ? "animate-spin" : ""}`}
						/>
						<span>{statusConfig.text}</span>
					</KioskBadge>
				</div>
			</div>
		</div>
	);
}
