import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AgreementFlow } from "@/components/agreement-flow";
import { ErrorDialog } from "@/components/error-dialog";
import { KioskContainer } from "@/components/kiosk-container";
import { KioskHeader } from "@/components/kiosk-header";
import { ReadyView } from "@/components/ready-view";
import { SessionTypeSelector } from "@/components/session-type-selector";
import { SetupView } from "@/components/setup-view";
import { TapNotification } from "@/components/tap-notification";
import { TapOutActionSelector } from "@/components/tap-out-action-selector";
import {
	connectSerial,
	disconnectSerial,
	type SerialSession,
} from "@/lib/card-scanner";
import { formatLog, getLogger } from "@/lib/logging";
import type { ConnectionStatus, TapEvent } from "@/types";

// Timeout constants (in milliseconds)
const SESSION_TYPE_TIMEOUT_MS = 15000;
const TAP_OUT_ACTION_TIMEOUT_MS = 15000;
const AGREEMENT_FLOW_TIMEOUT_MS = 30000;
const NOTIFICATION_DISPLAY_DURATION_MS = 3000;
const FADE_OUT_DURATION_MS = 300;
const FADE_OUT_TRIGGER_DELAY_MS = 200;
const SERIAL_CONNECTION_CHECK_INTERVAL_MS = 2000;

type AgreementData = {
	id: number;
	title: string;
	content: string;
	confirmationText: string;
};

type PendingAgreementState = {
	cardNumber: string;
	userName: string;
	agreements: AgreementData[];
};

type SessionTypeSelectionState = {
	cardNumber: string;
	userName: string;
};

type TapOutActionSelectionState = {
	cardNumber: string;
	userName: string;
	currentSessionType: "regular" | "staffing";
};

function App() {
	const log = getLogger("app");
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
	const [currentTapEvent, setCurrentTapEvent] = useState<TapEvent | null>(null);
	const [isExiting, setIsExiting] = useState<boolean>(false);
	const [isErrorExiting, setIsErrorExiting] = useState<boolean>(false);
	const [isProcessing, setIsProcessing] = useState<boolean>(false);
	const [pendingAgreement, setPendingAgreement] =
		useState<PendingAgreementState | null>(null);
	const [sessionTypeSelection, setSessionTypeSelection] =
		useState<SessionTypeSelectionState | null>(null);
	const [tapOutActionSelection, setTapOutActionSelection] =
		useState<TapOutActionSelectionState | null>(null);
	const serialRef = useRef<SerialSession | null>(null);
	const tapEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const sessionTypeSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const tapOutActionSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const agreementFlowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
	const handleTapInOut = async (
		cardNumber: string,
		sessionType?: "regular" | "staffing",
		tapAction?: "end_session" | "switch_to_staffing" | "switch_to_regular",
	) => {
		// Clear all dialogs and their timers when a new card is scanned
		if (sessionTypeSelectorTimeoutRef.current) {
			clearTimeout(sessionTypeSelectorTimeoutRef.current);
			sessionTypeSelectorTimeoutRef.current = null;
		}
		if (tapOutActionSelectorTimeoutRef.current) {
			clearTimeout(tapOutActionSelectorTimeoutRef.current);
			tapOutActionSelectorTimeoutRef.current = null;
		}
		if (agreementFlowTimeoutRef.current) {
			clearTimeout(agreementFlowTimeoutRef.current);
			agreementFlowTimeoutRef.current = null;
		}
		setSessionTypeSelection(null);
		setTapOutActionSelection(null);
		setPendingAgreement(null);

		// Show processing state
		setIsProcessing(true);

		try {
			log.info(
				formatLog("Tap requested", {
					cardId: cardNumber.slice(-6),
					sessionType: sessionType || "auto",
					action: tapAction || "none",
				}),
			);
			const result = await trpc.sessions.tapInOut.mutate({
				cardNumber,
				sessionType,
				tapAction,
			});

			// Check if user needs to choose session type
			if (result.status === "choose_session_type") {
				log.info(
					formatLog("Session type selection required", {
						userName: result.user.name,
					}),
				);

				setIsProcessing(false);
				setSessionTypeSelection({
					cardNumber,
					userName: result.user.name,
				});
				// Auto-hide after 15 seconds
				sessionTypeSelectorTimeoutRef.current = setTimeout(() => {
					setSessionTypeSelection(null);
				}, SESSION_TYPE_TIMEOUT_MS);
				return;
			}

			// Check if user needs to choose tap-out action
			if (result.status === "choose_tap_out_action") {
				log.info(
					formatLog("Tap-out action selection required", {
						userName: result.user.name,
						currentSessionType: result.currentSession?.sessionType || "unknown",
					}),
				);

				setIsProcessing(false);
				setTapOutActionSelection({
					cardNumber,
					userName: result.user.name,
					currentSessionType: result.currentSession?.sessionType || "regular",
				});
				// Auto-hide after 15 seconds
				tapOutActionSelectorTimeoutRef.current = setTimeout(() => {
					setTapOutActionSelection(null);
				}, TAP_OUT_ACTION_TIMEOUT_MS);
				return;
			}

			// Check if agreements are required
			if (result.status === "agreements_required" && result.missingAgreements) {
				log.info(
					formatLog("Agreements required", {
						userName: result.user.name,
						count: result.missingAgreements.length,
					}),
				);

				setIsProcessing(false);
				setPendingAgreement({
					cardNumber,
					userName: result.user.name,
					agreements: result.missingAgreements,
				});
				// Auto-hide after 30 seconds
				agreementFlowTimeoutRef.current = setTimeout(() => {
					setPendingAgreement(null);
					showError("Entry denied. Complete all agreements to tap in.");
				}, AGREEMENT_FLOW_TIMEOUT_MS);
				return;
			}

			// Only create event for successful taps
			if (
				result.status === "tapped_in" ||
				result.status === "tapped_out" ||
				result.status === "switched_to_staffing" ||
				result.status === "switched_to_regular"
			) {
				setIsProcessing(false);
				const event =
					(result.status === "switched_to_staffing" ||
						result.status === "switched_to_regular") &&
					result.endedSession &&
					result.newSession
						? ({
								status: result.status,
								user: result.user,
								endedSession: result.endedSession,
								newSession: result.newSession,
								id: crypto.randomUUID(),
								timestamp: new Date(),
							} as TapEvent)
						: result.session
							? ({
									status: result.status as "tapped_in" | "tapped_out",
									user: result.user,
									session: result.session,
									id: crypto.randomUUID(),
									timestamp: new Date(),
								} as TapEvent)
							: null;
				if (!event) {
					// Should not happen, but handle gracefully
					showError("Unexpected response from server");
					return;
				}

				log.info(
					formatLog("Tap successful", {
						status: result.status,
						userName: result.user.name,
						userId: result.user.id,
						sessionId:
							"session" in result ? result.session?.id : result.newSession?.id,
					}),
				);

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
					}, FADE_OUT_TRIGGER_DELAY_MS); // Brief fade-out duration
				} else {
					// No current event, show immediately
					setCurrentTapEvent(event);
					scheduleEventHide();
				}
			}
		} catch (error: unknown) {
			setIsProcessing(false);
			const message =
				error instanceof Error ? error.message : "Failed to process tap";
			log.error(formatLog("Tap failed", { error: message }));
			showError(message);
		}
	};

	const resetAgreementTimeout = () => {
		// Clear existing timeout
		if (agreementFlowTimeoutRef.current) {
			clearTimeout(agreementFlowTimeoutRef.current);
			agreementFlowTimeoutRef.current = null;
		}
		// Set new 30 second timeout
		agreementFlowTimeoutRef.current = setTimeout(() => {
			setPendingAgreement(null);
			showError("Entry denied. Complete all agreements to tap in.");
		}, AGREEMENT_FLOW_TIMEOUT_MS);
	};

	const handleAgreementComplete = async () => {
		if (!pendingAgreement) return;

		// Clear auto-hide timeout
		if (agreementFlowTimeoutRef.current) {
			clearTimeout(agreementFlowTimeoutRef.current);
			agreementFlowTimeoutRef.current = null;
		}

		try {
			// All agreements accepted, now tap in
			await handleTapInOut(pendingAgreement.cardNumber);
		} finally {
			setPendingAgreement(null);
		}
	};

	const handleAgreementCancel = () => {
		// Clear auto-hide timeout
		if (agreementFlowTimeoutRef.current) {
			clearTimeout(agreementFlowTimeoutRef.current);
			agreementFlowTimeoutRef.current = null;
		}
		setPendingAgreement(null);
		showError("Entry denied. Complete all agreements to tap in.");
	};

	const handleAgreementError = (message: string) => {
		showError(message);
	};

	const handleSessionTypeSelect = async (type: "regular" | "staffing") => {
		if (!sessionTypeSelection) return;

		// Clear auto-hide timeout
		if (sessionTypeSelectorTimeoutRef.current) {
			clearTimeout(sessionTypeSelectorTimeoutRef.current);
			sessionTypeSelectorTimeoutRef.current = null;
		}

		try {
			await handleTapInOut(sessionTypeSelection.cardNumber, type);
		} finally {
			setSessionTypeSelection(null);
		}
	};

	const handleSessionTypeCancel = () => {
		// Clear auto-hide timeout
		if (sessionTypeSelectorTimeoutRef.current) {
			clearTimeout(sessionTypeSelectorTimeoutRef.current);
			sessionTypeSelectorTimeoutRef.current = null;
		}
		setSessionTypeSelection(null);
	};

	const handleTapOutActionSelect = async (
		action: "end_session" | "switch_to_staffing" | "switch_to_regular",
	) => {
		if (!tapOutActionSelection) return;

		// Clear auto-hide timeout
		if (tapOutActionSelectorTimeoutRef.current) {
			clearTimeout(tapOutActionSelectorTimeoutRef.current);
			tapOutActionSelectorTimeoutRef.current = null;
		}

		try {
			await handleTapInOut(tapOutActionSelection.cardNumber, undefined, action);
		} finally {
			setTapOutActionSelection(null);
		}
	};

	const handleTapOutActionCancel = () => {
		// Clear auto-hide timeout
		if (tapOutActionSelectorTimeoutRef.current) {
			clearTimeout(tapOutActionSelectorTimeoutRef.current);
			tapOutActionSelectorTimeoutRef.current = null;
		}
		setTapOutActionSelection(null);
	};

	// Schedule the event to hide after a delay
	const scheduleEventHide = () => {
		tapEventTimeoutRef.current = setTimeout(() => {
			setIsExiting(true);
			exitTimeoutRef.current = setTimeout(() => {
				setCurrentTapEvent(null);
				setIsExiting(false);
			}, FADE_OUT_DURATION_MS); // Fade-out duration
		}, NOTIFICATION_DISPLAY_DURATION_MS); // Display duration
	};

	// Schedule error to hide after a delay
	const scheduleErrorHide = () => {
		errorTimeoutRef.current = setTimeout(() => {
			setIsErrorExiting(true);
			errorExitTimeoutRef.current = setTimeout(() => {
				setErrorMessage("");
				setIsErrorExiting(false);
			}, FADE_OUT_DURATION_MS); // Fade-out duration
		}, NOTIFICATION_DISPLAY_DURATION_MS); // Display duration (3 seconds)
	};

	// Show error with animation
	const showError = (message: string) => {
		// Clear any existing error timers
		if (errorTimeoutRef.current) {
			clearTimeout(errorTimeoutRef.current);
		}
		if (errorExitTimeoutRef.current) {
			clearTimeout(errorExitTimeoutRef.current);
		}

		// If there's a current error, trigger exit animation first
		if (errorMessage) {
			setIsErrorExiting(true);
			errorExitTimeoutRef.current = setTimeout(() => {
				setIsErrorExiting(false);
				setErrorMessage(message);
				scheduleErrorHide();
			}, FADE_OUT_TRIGGER_DELAY_MS); // Brief fade-out duration
		} else {
			// No current error, show immediately
			setErrorMessage(message);
			scheduleErrorHide();
		}
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
			if (errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current);
			}
			if (errorExitTimeoutRef.current) {
				clearTimeout(errorExitTimeoutRef.current);
			}
			if (sessionTypeSelectorTimeoutRef.current) {
				clearTimeout(sessionTypeSelectorTimeoutRef.current);
			}
			if (tapOutActionSelectorTimeoutRef.current) {
				clearTimeout(tapOutActionSelectorTimeoutRef.current);
			}
			if (agreementFlowTimeoutRef.current) {
				clearTimeout(agreementFlowTimeoutRef.current);
			}
		};
	}, []);

	const connectToSerial = async () => {
		setConnectionStatus("connecting");
		setErrorMessage("");

		log.info("Connecting to card reader");

		const session = await connectSerial(
			(scan) => {
				// Card scan is already logged in card-scanner.ts
				// Just handle the tap-in/tap-out
				void handleTapInOut(scan.data);
			},
			(err) => {
				log.error(formatLog("Serial connection error", { error: err }));
				showError(err);
				setConnectionStatus("error");
				// Auto-disconnect on error
				void disconnectSerialHandler();
			},
		);
		if (session) {
			serialRef.current = session;
			setConnectionStatus("connected");
			setErrorMessage("");
			log.info("Card reader connected successfully");
		} else {
			setConnectionStatus("error");
			log.error("Failed to connect to card reader");
		}
	};

	const disconnectSerialHandler = async () => {
		await disconnectSerial(serialRef.current);
		serialRef.current = null;
		setConnectionStatus("disconnected");
		log.info("Card reader disconnected");
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
					log.warn("Card reader disconnected - device unplugged");
					setConnectionStatus("error");
					showError("Kiosk disconnected - card reader was unplugged");
					void disconnectSerialHandler();
				}
			}, SERIAL_CONNECTION_CHECK_INTERVAL_MS);

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
		<KioskContainer>
			<div className="h-full w-full overflow-hidden dark flex flex-col">
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

				<main className="flex-1 overflow-hidden relative">
					{/* Error Dialog */}
					{errorMessage && (
						<ErrorDialog message={errorMessage} isExiting={isErrorExiting} />
					)}
					{/* Session Type Selection */}
					{sessionTypeSelection && (
						<SessionTypeSelector
							userName={sessionTypeSelection.userName}
							onSelectType={handleSessionTypeSelect}
							onCancel={handleSessionTypeCancel}
						/>
					)}
					{/* Tap-Out Action Selection */}
					{tapOutActionSelection && (
						<TapOutActionSelector
							userName={tapOutActionSelection.userName}
							currentSessionType={tapOutActionSelection.currentSessionType}
							onSelectAction={handleTapOutActionSelect}
							onCancel={handleTapOutActionCancel}
						/>
					)}
					{/* Agreement Flow */}
					{pendingAgreement && (
						<AgreementFlow
							agreements={pendingAgreement.agreements}
							userName={pendingAgreement.userName}
							cardNumber={pendingAgreement.cardNumber}
							onComplete={handleAgreementComplete}
							onCancel={handleAgreementCancel}
							onError={handleAgreementError}
							onAgreementProgress={resetAgreementTimeout}
						/>
					)}{" "}
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
								isProcessing={isProcessing}
								onToggleFullscreen={toggleFullscreen}
							/>
						)}
					</div>
				</main>
			</div>
		</KioskContainer>
	);
}

export default App;
