import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	Maximize,
	XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	type CardScan,
	connectSerial,
	disconnectSerial,
	type SerialSession,
} from "@/lib/card-scanner";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

function App() {
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const [lastCardScan, setLastCardScan] = useState<string>("");
	const [scanHistory, setScanHistory] = useState<CardScan[]>([]);
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
	const serialRef = useRef<SerialSession | null>(null);

	const connectToSerial = async () => {
		setConnectionStatus("connecting");
		setErrorMessage("");
		const session = await connectSerial(
			(scan) => {
				setLastCardScan(scan.data);
				setScanHistory((prev) => [scan, ...prev.slice(0, 9)]);
			},
			(err) => {
				setErrorMessage(err);
				setConnectionStatus("error");
			},
		);
		if (session) {
			serialRef.current = session;
			setConnectionStatus("connected");
		} else {
			setConnectionStatus("error");
		}
	};

	const disconnectSerialHandler = async () => {
		await disconnectSerial(serialRef.current);
		serialRef.current = null;
		setConnectionStatus("disconnected");
		setLastCardScan("");
	};

	const clearHistory = () => {
		setScanHistory([]);
		setLastCardScan("");
	};

	const toggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			await document.documentElement.requestFullscreen();
			setIsFullscreen(true);
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);

		return () => {
			disconnectSerial(serialRef.current);
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

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
					icon: AlertCircle,
					text: "Disconnected",
					variant: "outline" as const,
					className: "",
				};
		}
	};

	const statusConfig = getStatusConfig();
	const StatusIcon = statusConfig.icon;
	const logoUrl = new URL("./assets/logo_dark.svg", import.meta.url).href;

	return (
		<div className="h-screen w-screen overflow-hidden bg-background dark flex flex-col">
			<div className="flex-none px-4 py-3 sm:px-6 sm:py-4">
				<div className="mx-auto max-w-6xl flex items-center justify-between">
					<img src={logoUrl} alt="HUMS" className="h-8 sm:h-10 w-auto" />
					<div className="flex items-center gap-3">
						{!isFullscreen && (
							<Button
								variant="ghost"
								size="icon"
								onClick={toggleFullscreen}
								title="Enter Fullscreen"
							>
								<Maximize className="h-5 w-5" />
							</Button>
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

			<main className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 overflow-hidden">
				<div className="mx-auto max-w-6xl h-full flex items-center justify-center">
					{connectionStatus !== "connected" ? (
						<div className="w-full max-w-2xl flex flex-col gap-4">
							<Card>
								<CardContent className="flex flex-col items-center gap-4 sm:gap-6 py-8 sm:py-12">
									<p className="text-base sm:text-lg font-medium">
										Card reader not connected
									</p>
									<p className="text-xs sm:text-sm text-muted-foreground text-center max-w-xl px-2">
										Please connect a compatible USB serial card reader to the
										kiosk and press "Connect". If your device requires
										authorization, allow the browser to access the device when
										prompted.
									</p>

									<div className="flex items-center gap-3">
										<Button
											onClick={connectToSerial}
											variant="default"
											size="lg"
											disabled={connectionStatus === "connecting"}
										>
											{connectionStatus === "connecting" ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Connecting...
												</>
											) : (
												"Connect"
											)}
										</Button>
										{scanHistory.length > 0 && (
											<Button onClick={clearHistory} variant="outline">
												Clear History
											</Button>
										)}
									</div>
								</CardContent>
							</Card>

							{errorMessage && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Connection Error</AlertTitle>
									<AlertDescription>{errorMessage}</AlertDescription>
								</Alert>
							)}
						</div>
					) : (
						<div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 gap-4 content-center">
							<Card className="h-fit">
								<CardHeader>
									<CardTitle>Latest Scan</CardTitle>
								</CardHeader>
								<CardContent>
									{lastCardScan ? (
										<div className="rounded-md bg-muted p-3 sm:p-4 font-mono text-sm sm:text-base break-all">
											{lastCardScan}
										</div>
									) : (
										<div className="text-sm text-muted-foreground">
											No scans recorded yet
										</div>
									)}
								</CardContent>
							</Card>

							<Card className="h-fit max-h-[40vh] overflow-hidden flex flex-col">
								<CardHeader>
									<CardTitle>Scan History</CardTitle>
								</CardHeader>
								<CardContent className="overflow-y-auto">
									{scanHistory.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											No recent scans
										</div>
									) : (
										<div className="space-y-2">
											{scanHistory.map((scan, index) => (
												<div key={scan.id}>
													{index > 0 && <Separator className="my-2" />}
													<div className="flex items-start justify-between gap-4">
														<div className="min-w-0 flex-1 font-mono text-xs sm:text-sm break-all">
															{scan.data}
														</div>
														<div className="text-xs text-muted-foreground whitespace-nowrap">
															{scan.timestamp.toLocaleTimeString()}
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</CardContent>
							</Card>

							<div className="lg:col-span-2 flex gap-3 justify-center">
								<Button onClick={disconnectSerialHandler} variant="secondary">
									Disconnect
								</Button>
								<Button onClick={clearHistory} variant="outline">
									Clear History
								</Button>
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}

export default App;
