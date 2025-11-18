import { AlertCircle, CheckCircle2, Loader2, Usb } from "lucide-react";
import { motion } from "motion/react";
import { KioskCard } from "@/components/kiosk-ui";
import type { ConnectionStatus, KioskStatus } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

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
				<div className="max-w-2xl mx-auto">
					<KioskCard className="border-destructive shadow-2xl p-6">
						<div className="flex flex-col items-center gap-6">
							<div className="relative flex items-center justify-center">
								<motion.div
									initial={{ scale: 0.85, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ duration: 0.6, ease: "easeOut" }}
								>
									<AlertCircle className="icon-2xl text-destructive" />
								</motion.div>
								<motion.div
									className="absolute inset-0"
									initial={{ scale: 0.9, opacity: 0.4 }}
									animate={{ scale: [0.9, 1.4], opacity: [0.4, 0] }}
									transition={{
										duration: 1.4,
										repeat: Infinity,
										ease: "easeOut",
									}}
								>
									<AlertCircle className="w-32 h-32 text-destructive opacity-40" />
								</motion.div>
							</div>
							<div className="text-center gap-3 flex flex-col">
								<h2 className="text-4xl font-bold text-destructive">
									Kiosk Not Registered
								</h2>
								<p className="text-lg text-muted-foreground max-w-md mx-auto">
									This device is not registered as a kiosk. Please contact an
									administrator to register this kiosk before using
									tap-in/tap-out functionality.
								</p>
								{kioskStatus.ip && (
									<div className="flex justify-center mt-2">
										<Badge variant="outline" className="text-base">
											IP: {kioskStatus.ip}
										</Badge>
									</div>
								)}
							</div>
						</div>
					</KioskCard>
				</div>
			</div>
		);
	}

	const isConnecting = connectionStatus === "connecting";
	const isConnected = connectionStatus === "connected";
	const hasError = Boolean(errorMessage);
	const cardBorder = isConnecting
		? "border-primary"
		: hasError
			? "border-destructive"
			: "border-muted-foreground/30";
	const statusTitle = isConnecting
		? "Starting Kiosk..."
		: hasError
			? "Connection Failed"
			: "Kiosk Setup";
	const statusDescription = isConnecting
		? "Connecting to card reader. Please wait..."
		: hasError
			? errorMessage
			: "Connect a USB card reader to this device, then press Start to enable tap-in/tap-out functionality.";
	const indicatorColor =
		isConnecting || isConnected
			? "hsl(var(--primary))"
			: hasError
				? "hsl(var(--destructive))"
				: "hsl(var(--muted))";

	// Show card reader connection UI with redesigned interface
	return (
		<div className="w-full h-full flex items-center justify-center overflow-hidden">
			<div className="max-w-2xl mx-auto gap-4 flex flex-col">
				<motion.div
					animate={
						isConnecting
							? { scale: [1, 0.98, 1], opacity: [1, 0.85, 1] }
							: { scale: 1, opacity: 1 }
					}
					transition={
						isConnecting
							? { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
							: { duration: 0.3 }
					}
				>
					<KioskCard
						className={`shadow-2xl transition-all duration-300 p-6 ${cardBorder}`}
					>
						<div className="flex flex-col items-center gap-6">
							<div className="relative w-12 h-12">
								{isConnecting ? (
									<motion.span
										className="inline-flex"
										animate={{ rotate: 360 }}
										transition={{
											repeat: Infinity,
											duration: 1,
											ease: "linear",
										}}
									>
										<Loader2 className="w-full h-full text-primary" />
									</motion.span>
								) : hasError ? (
									<motion.div
										initial={{ scale: 0.85, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ duration: 0.4, ease: "easeOut" }}
									>
										<AlertCircle className="w-full h-full text-destructive" />
									</motion.div>
								) : (
									<motion.div
										initial={{ opacity: 0, y: 6 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.4, ease: "easeOut" }}
									>
										<Usb className="w-full h-full text-muted-foreground" />
									</motion.div>
								)}
							</div>

							<div className="text-center gap-3 flex flex-col">
								<h2
									className={`text-4xl font-bold ${
										isConnecting
											? "text-primary"
											: hasError
												? "text-destructive"
												: ""
									}`}
								>
									{statusTitle}
								</h2>
								<p className="text-lg text-muted-foreground max-w-md mx-auto">
									{statusDescription}
								</p>
							</div>

							<div className="flex gap-3 items-center mt-2">
								<Button
									onClick={onConnect}
									variant={hasError ? "destructive" : "default"}
									disabled={isConnecting}
									className="transition-all whitespace-nowrap gap-2"
								>
									{isConnecting ? (
										<>
											<motion.span
												className="inline-flex"
												animate={{ rotate: 360 }}
												transition={{
													repeat: Infinity,
													duration: 1,
													ease: "linear",
												}}
											>
												<Loader2 className="icon-md" />
											</motion.span>
											Connecting...
										</>
									) : hasError ? (
										<>
											<AlertCircle className="icon-md" />
											Retry Connection
										</>
									) : (
										<>
											<CheckCircle2 className="icon-md" />
											Start Kiosk
										</>
									)}
								</Button>
							</div>

							{/* Connection status indicators */}
							<div className="flex gap-2 items-center">
								<div className="flex items-center gap-2">
									<motion.span
										className="rounded-full"
										style={{ width: "0.75rem", height: "0.75rem" }}
										animate={{
											backgroundColor: indicatorColor,
											scale: isConnecting ? [1, 0.9, 1] : 1,
										}}
										transition={{
											duration: isConnecting ? 1 : 0.3,
											repeat: isConnecting ? Infinity : 0,
											ease: "easeInOut",
										}}
									/>
									<span className="text-sm text-muted-foreground">
										{isConnecting
											? "Connecting"
											: isConnected
												? "Connected"
												: hasError
													? "Error"
													: "Disconnected"}
									</span>
								</div>
							</div>
						</div>
					</KioskCard>
				</motion.div>
			</div>
		</div>
	);
}
