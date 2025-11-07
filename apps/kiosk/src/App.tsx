import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { KioskHeader } from "@/components/kiosk-header";
import { ReadyView } from "@/components/ready-view";
import { SetupView } from "@/components/setup-view";
import { TapNotification } from "@/components/tap-notification";
import {
	connectSerial,
	disconnectSerial,
	type SerialSession,
} from "@/lib/card-scanner";
import { getLogger } from "@/lib/logging";
import type { ConnectionStatus, TapEvent } from "@/types";

function App() {
	const log = getLogger("app");
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
	const [currentTapEvent, setCurrentTapEvent] = useState<TapEvent | null>(null);
	const [isExiting, setIsExiting] = useState<boolean>(false);
	const serialRef = useRef<SerialSession | null>(null);
	const tapEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Check kiosk status using TanStack Query
	const { data: kioskStatusData, isLoading: kioskStatusLoading } = useQuery({
		queryKey: ["kioskStatus"],
		queryFn: async () => {
			return await trpc.kiosks.checkStatus.query({});
		},
		retry: 1,
		refetchOnWindowFocus: false,
	});

	const kioskStatus = {
		isKiosk: kioskStatusData?.status ?? false,
		ip: kioskStatusData?.status
			? kioskStatusData.kiosk?.ipAddress
			: kioskStatusData?.ip,
		checking: kioskStatusLoading,
	};

	// Handle new tap event - immediately show most recent
	const handleTapInOut = async (cardNumber: string) => {
		try {
			try {
				log.info("tap-request", { cardNumber });
			} catch {}
			const result = await trpc.sessions.tapInOut.mutate({ cardNumber });
			const event: TapEvent = {
				...result,
				id: crypto.randomUUID(),
				timestamp: new Date(),
			};

			try {
				log.info("tap-result", {
					cardNumber,
					status: result.status,
					user: {
						id: result.user?.id,
						username: result.user?.username,
						name: result.user?.name,
					},
					sessionId: result.session?.id,
				});
			} catch {}

			// Clear any existing timers
			if (tapEventTimeoutRef.current) {
				clearTimeout(tapEventTimeoutRef.current);
			}
			if (exitTimeoutRef.current) {
				clearTimeout(exitTimeoutRef.current);
			}

			// If there's a current event, trigger exit animation first
			if (currentTapEvent) {
				setIsExiting(true);
				exitTimeoutRef.current = setTimeout(() => {
					setIsExiting(false);
					setCurrentTapEvent(event);
					scheduleEventHide();
				}, 200); // Brief fade-out duration
			} else {
				// No current event, show immediately
				setCurrentTapEvent(event);
				scheduleEventHide();
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to process tap";
			try {
				log.error("tap-error", { cardNumber, message });
			} catch {}
			setErrorMessage(message);
			setTimeout(() => setErrorMessage(""), 5000);
		}
	};

	// Schedule the event to hide after a delay
	const scheduleEventHide = () => {
		tapEventTimeoutRef.current = setTimeout(() => {
			setIsExiting(true);
			exitTimeoutRef.current = setTimeout(() => {
				setCurrentTapEvent(null);
				setIsExiting(false);
			}, 300); // Fade-out duration
		}, 3000); // Display duration
	};

	// Cleanup timers on unmount
	useEffect(() => {
		return () => {
			if (tapEventTimeoutRef.current) {
				clearTimeout(tapEventTimeoutRef.current);
			}
			if (exitTimeoutRef.current) {
				clearTimeout(exitTimeoutRef.current);
			}
		};
	}, []);

	const connectToSerial = async () => {
		setConnectionStatus("connecting");
		setErrorMessage("");
		const session = await connectSerial(
			(scan) => {
				try {
					log.info("scan-received", { scanId: scan.id, data: scan.data });
				} catch {}
				// Call tap-in/tap-out endpoint
				void handleTapInOut(scan.data);
			},
			(err) => {
				try {
					log.error("serial-error", { message: err });
				} catch {}
				setErrorMessage(err);
				setConnectionStatus("error");
				// Auto-disconnect on error
				void disconnectSerialHandler();
			},
		);
		if (session) {
			serialRef.current = session;
			setConnectionStatus("connected");
			setErrorMessage("");
		} else {
			setConnectionStatus("error");
		}
	};

	const disconnectSerialHandler = async () => {
		await disconnectSerial(serialRef.current);
		serialRef.current = null;
		setConnectionStatus("disconnected");
	};

	// Monitor for serial port disconnection
	useEffect(() => {
		if (
			connectionStatus === "connected" &&
			serialRef.current &&
			serialRef.current.port
		) {
			const checkConnection = setInterval(() => {
				// Check if port is still readable
				if (!serialRef.current?.port.readable) {
					setConnectionStatus("error");
					setErrorMessage("Kiosk disconnected - card reader was unplugged");
					void disconnectSerialHandler();
				}
			}, 2000);

			return () => clearInterval(checkConnection);
		}
	}, [connectionStatus]);

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

		// Listen for fullscreen change across browsers
		const fsEvents = [
			"fullscreenchange",
			"webkitfullscreenchange",
			"mozfullscreenchange",
			"MSFullscreenChange",
		];

		for (const ev of fsEvents) {
			document.addEventListener(ev, handleFullscreenChange);
		}

		return () => {
			disconnectSerial(serialRef.current);
			for (const ev of fsEvents) {
				document.removeEventListener(ev, handleFullscreenChange);
			}
		};
	}, []);

	const logoUrl = new URL("./assets/logo_dark.svg", import.meta.url).href;

	// PRE-CONNECTION: Show technical details for setup
	const isPreConnection =
		!kioskStatus.isKiosk ||
		connectionStatus === "disconnected" ||
		connectionStatus === "connecting" ||
		connectionStatus === "error";

	return (
		<div className="h-screen w-screen overflow-hidden bg-background dark flex flex-col">
			{/* Header - Only show in pre-connection state */}
			{isPreConnection && (
				<KioskHeader
					logoUrl={logoUrl}
					connectionStatus={connectionStatus}
					kioskStatus={kioskStatus}
					isFullscreen={isFullscreen}
					onToggleFullscreen={toggleFullscreen}
				/>
			)}

			<main className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 overflow-hidden relative">
				{/* Tap Response Notification */}
				{currentTapEvent && (
					<TapNotification event={currentTapEvent} isExiting={isExiting} />
				)}

				<div className="h-full flex items-center justify-center">
					{connectionStatus !== "connected" ? (
						<SetupView
							connectionStatus={connectionStatus}
							kioskStatus={kioskStatus}
							errorMessage={errorMessage}
							onConnect={connectToSerial}
						/>
					) : (
						<ReadyView
							logoUrl={logoUrl}
							isFullscreen={isFullscreen}
							onToggleFullscreen={toggleFullscreen}
						/>
					)}
				</div>
			</main>
		</div>
	);
}

export default App;
