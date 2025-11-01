import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
			<div className="w-full mx-auto max-w-2xl flex flex-col gap-4">
				<Card>
					<CardContent className="flex flex-col items-center gap-4 sm:gap-6 py-8 sm:py-12">
						<AlertCircle className="h-16 w-16 text-destructive" />
						<div className="text-center space-y-4">
							<h2 className="text-2xl font-bold">Kiosk Not Registered</h2>
							<p className="text-muted-foreground">
								This device is not registered as a kiosk. Please contact an
								administrator to register this kiosk before using tap-in/tap-out
								functionality.
							</p>
							{kioskStatus.ip && (
								<div className="pt-4">
									<Badge variant="outline" className="text-base px-4 py-2">
										IP: {kioskStatus.ip}
									</Badge>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Show card reader connection UI
	return (
		<div className="w-full mx-auto max-w-2xl flex flex-col gap-4">
			<Card>
				<CardContent className="flex flex-col items-center gap-4 sm:gap-6 py-8 sm:py-12">
					<AlertCircle className="h-16 w-16 text-muted-foreground" />
					<div className="text-center space-y-4">
						<h2 className="text-2xl font-bold">Kiosk Not Started</h2>
						<p className="text-sm text-muted-foreground max-w-xl">
							Please connect a USB card reader to the device. Once connected,
							start the kiosk to enable tap-in/tap-out functionality.
						</p>
					</div>

					<div className="flex items-center gap-3 pt-4">
						<Button
							onClick={onConnect}
							variant="default"
							size="lg"
							disabled={connectionStatus === "connecting"}
							className="text-lg px-8 py-6"
						>
							{connectionStatus === "connecting" ? (
								<>
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
									Starting...
								</>
							) : (
								"Start Kiosk"
							)}
						</Button>
					</div>
				</CardContent>
			</Card>

			{errorMessage && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Startup Error</AlertTitle>
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
