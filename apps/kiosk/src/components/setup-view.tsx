import { AlertCircle, CheckCircle2, Loader2, Usb } from "lucide-react";
import { KioskBadge, KioskButton, KioskCard } from "@/components/kiosk-ui";
import type { ConnectionStatus, KioskStatus } from "@/types";

interface SetupViewProps {
	connectionStatus: ConnectionStatus;
	kioskStatus: KioskStatus;
	errorMessage: string;
	onConnect: () => void;
}

export function SetupView({
	connectionStatus,
	kioskStatus,
	errorMessage,
	onConnect,
}: SetupViewProps) {
	// Show kiosk not registered message
	if (!kioskStatus.isKiosk && !kioskStatus.checking) {
		return (
			<div className="w-full h-full flex items-center justify-center overflow-hidden">
				<div
					className="kiosk-max-w-2xl kiosk-mx-auto"
					style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
				>
					<KioskCard
						className="border-destructive shadow-2xl"
						style={{
							borderWidth: "calc(4px * var(--kiosk-scale))",
							padding: "calc(2rem * var(--kiosk-scale))",
						}}
					>
						<div className="flex flex-col items-center kiosk-gap-6">
							<div className="relative">
								<AlertCircle className="kiosk-icon-2xl text-destructive animate-in zoom-in-50 duration-700" />
								<div className="absolute inset-0 animate-ping">
									<AlertCircle className="kiosk-icon-2xl text-destructive opacity-40" />
								</div>
							</div>
							<div className="text-center kiosk-gap-3 flex flex-col">
								<h2 className="kiosk-text-4xl font-bold text-destructive">
									Kiosk Not Registered
								</h2>
								<p className="kiosk-text-lg text-muted-foreground kiosk-max-w-md kiosk-mx-auto">
									This device is not registered as a kiosk. Please contact an
									administrator to register this kiosk before using
									tap-in/tap-out functionality.
								</p>
								{kioskStatus.ip && (
									<div className="flex justify-center kiosk-mt-2">
										<KioskBadge
											variant="outline"
											className="kiosk-text-base"
											style={{
												padding:
													"calc(0.375rem * var(--kiosk-scale)) calc(0.75rem * var(--kiosk-scale))",
											}}
										>
											IP: {kioskStatus.ip}
										</KioskBadge>
									</div>
								)}
							</div>
						</div>
					</KioskCard>
				</div>
			</div>
		);
	}

	// Show card reader connection UI with redesigned interface
	return (
		<div className="w-full h-full flex items-center justify-center overflow-hidden">
			<div
				className="kiosk-max-w-2xl kiosk-mx-auto kiosk-gap-4 flex flex-col"
				style={{ padding: "calc(1rem * var(--kiosk-scale))" }}
			>
				<KioskCard
					className={`shadow-2xl transition-all duration-300 ${
						connectionStatus === "connecting"
							? "border-primary animate-pulse"
							: errorMessage
								? "border-destructive"
								: "border-muted-foreground/30"
					}`}
					style={{
						borderWidth: "calc(4px * var(--kiosk-scale))",
						padding: "calc(2rem * var(--kiosk-scale))",
					}}
				>
					<div className="flex flex-col items-center kiosk-gap-6">
						<div className="relative">
							{connectionStatus === "connecting" ? (
								<Loader2 className="kiosk-icon-2xl text-primary animate-spin" />
							) : errorMessage ? (
								<AlertCircle className="kiosk-icon-2xl text-destructive animate-in zoom-in-50 duration-700" />
							) : (
								<Usb className="kiosk-icon-2xl text-muted-foreground" />
							)}
						</div>

						<div className="text-center kiosk-gap-3 flex flex-col">
							<h2
								className={`kiosk-text-4xl font-bold ${
									connectionStatus === "connecting"
										? "text-primary"
										: errorMessage
											? "text-destructive"
											: ""
								}`}
							>
								{connectionStatus === "connecting"
									? "Starting Kiosk..."
									: errorMessage
										? "Connection Failed"
										: "Kiosk Setup"}
							</h2>
							<p className="kiosk-text-lg text-muted-foreground kiosk-max-w-md kiosk-mx-auto">
								{connectionStatus === "connecting"
									? "Connecting to card reader. Please wait..."
									: errorMessage
										? errorMessage
										: "Connect a USB card reader to this device, then press Start to enable tap-in/tap-out functionality."}
							</p>
						</div>

						<div className="flex kiosk-gap-3 items-center kiosk-mt-2">
							<KioskButton
								onClick={onConnect}
								variant={errorMessage ? "destructive" : "default"}
								disabled={connectionStatus === "connecting"}
								className="transition-all whitespace-nowrap"
								style={{
									fontSize: "calc(1.125rem * var(--kiosk-scale))",
									padding:
										"calc(0.75rem * var(--kiosk-scale)) calc(1.5rem * var(--kiosk-scale))",
									minHeight: "calc(3rem * var(--kiosk-scale))",
								}}
							>
								{connectionStatus === "connecting" ? (
									<>
										<Loader2
											className="kiosk-icon-md animate-spin"
											style={{
												marginRight: "calc(0.5rem * var(--kiosk-scale))",
											}}
										/>
										Connecting...
									</>
								) : errorMessage ? (
									<>
										<AlertCircle
											className="kiosk-icon-md"
											style={{
												marginRight: "calc(0.5rem * var(--kiosk-scale))",
											}}
										/>
										Retry Connection
									</>
								) : (
									<>
										<CheckCircle2
											className="kiosk-icon-md"
											style={{
												marginRight: "calc(0.5rem * var(--kiosk-scale))",
											}}
										/>
										Start Kiosk
									</>
								)}
							</KioskButton>
						</div>

						{/* Connection status indicators */}
						<div className="flex kiosk-gap-2 items-center">
							<div className="flex items-center kiosk-gap-2">
								<div
									className="kiosk-rounded-full transition-colors"
									style={{
										width: "calc(0.625rem * var(--kiosk-scale))",
										height: "calc(0.625rem * var(--kiosk-scale))",
										backgroundColor:
											connectionStatus === "connecting" ||
											connectionStatus === "connected"
												? "hsl(var(--primary))"
												: errorMessage
													? "hsl(var(--destructive))"
													: "hsl(var(--muted))",
									}}
								/>
								<span className="kiosk-text-sm text-muted-foreground">
									{connectionStatus === "connecting"
										? "Connecting"
										: connectionStatus === "connected"
											? "Connected"
											: errorMessage
												? "Error"
												: "Disconnected"}
								</span>
							</div>
						</div>
					</div>
				</KioskCard>
			</div>
		</div>
	);
}
