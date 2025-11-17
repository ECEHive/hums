import { trpc } from "@ecehive/trpc/client";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatLog, getLogger } from "@/lib/logging";
import type { TapEvent } from "@/types";

const SESSION_TYPE_TIMEOUT_MS = 15000;
const TAP_OUT_ACTION_TIMEOUT_MS = 15000;
const AGREEMENT_FLOW_TIMEOUT_MS = 30000;
const NOTIFICATION_DISPLAY_DURATION_MS = 3000;
const FADE_OUT_DURATION_MS = 300;
const FADE_OUT_TRIGGER_DELAY_MS = 200;

type AgreementData = {
	id: number;
	title: string;
	content: string;
	confirmationText: string;
};

export type PendingAgreementState = {
	cardNumber: string;
	userName: string;
	agreements: AgreementData[];
};

export type SessionTypeSelectionState = {
	cardNumber: string;
	userName: string;
};

export type TapOutActionSelectionState = {
	cardNumber: string;
	userName: string;
	currentSessionType: "regular" | "staffing";
};

export type ErrorDialogState = {
	message: string;
	isExiting: boolean;
};

export type TapNotificationState = {
	event: TapEvent | null;
	isExiting: boolean;
};

const clearTimer = (ref: MutableRefObject<NodeJS.Timeout | null>) => {
	if (ref.current) {
		clearTimeout(ref.current);
		ref.current = null;
	}
};

export function useTapWorkflow() {
	const log = useMemo(() => getLogger("app"), []);

	const [isProcessing, setIsProcessing] = useState(false);
	const [pendingAgreement, setPendingAgreement] =
		useState<PendingAgreementState | null>(null);
	const [sessionTypeSelection, setSessionTypeSelection] =
		useState<SessionTypeSelectionState | null>(null);
	const [tapOutActionSelection, setTapOutActionSelection] =
		useState<TapOutActionSelectionState | null>(null);
	const [currentTapEvent, setCurrentTapEvent] = useState<TapEvent | null>(null);
	const [isNotificationExiting, setIsNotificationExiting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [isErrorExiting, setIsErrorExiting] = useState(false);

	const currentTapEventRef = useRef<TapEvent | null>(null);
	useEffect(() => {
		currentTapEventRef.current = currentTapEvent;
	}, [currentTapEvent]);

	const tapEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const sessionTypeSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const tapOutActionSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const agreementFlowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const scheduleEventHide = useCallback(() => {
		clearTimer(tapEventTimeoutRef);
		tapEventTimeoutRef.current = setTimeout(() => {
			setIsNotificationExiting(true);
			exitTimeoutRef.current = setTimeout(() => {
				setCurrentTapEvent(null);
				setIsNotificationExiting(false);
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, []);

	const scheduleErrorHide = useCallback(() => {
		errorTimeoutRef.current = setTimeout(() => {
			setIsErrorExiting(true);
			errorExitTimeoutRef.current = setTimeout(() => {
				setErrorMessage("");
				setIsErrorExiting(false);
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, []);

	const showError = useCallback(
		(message: string) => {
			clearTimer(errorTimeoutRef);
			clearTimer(errorExitTimeoutRef);

			if (errorMessage) {
				setIsErrorExiting(true);
				errorExitTimeoutRef.current = setTimeout(() => {
					setIsErrorExiting(false);
					setErrorMessage(message);
					scheduleErrorHide();
				}, FADE_OUT_TRIGGER_DELAY_MS);
			} else {
				setErrorMessage(message);
				scheduleErrorHide();
			}
		},
		[errorMessage, scheduleErrorHide],
	);

	const resetAgreementTimeout = useCallback(() => {
		clearTimer(agreementFlowTimeoutRef);
		agreementFlowTimeoutRef.current = setTimeout(() => {
			setPendingAgreement(null);
			showError("Entry denied. Complete all agreements to tap in.");
		}, AGREEMENT_FLOW_TIMEOUT_MS);
	}, [showError]);

	const handleTapInOut = useCallback(
		async (
			cardNumber: string,
			sessionType?: "regular" | "staffing",
			tapAction?: "end_session" | "switch_to_staffing" | "switch_to_regular",
		) => {
			clearTimer(sessionTypeSelectorTimeoutRef);
			clearTimer(tapOutActionSelectorTimeoutRef);
			clearTimer(agreementFlowTimeoutRef);
			setSessionTypeSelection(null);
			setTapOutActionSelection(null);
			setPendingAgreement(null);
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

				if (result.status === "choose_session_type") {
					setIsProcessing(false);
					setSessionTypeSelection({
						cardNumber,
						userName: result.user.name,
					});
					sessionTypeSelectorTimeoutRef.current = setTimeout(() => {
						setSessionTypeSelection(null);
					}, SESSION_TYPE_TIMEOUT_MS);
					return;
				}

				if (result.status === "choose_tap_out_action") {
					setIsProcessing(false);
					setTapOutActionSelection({
						cardNumber,
						userName: result.user.name,
						currentSessionType: result.currentSession?.sessionType || "regular",
					});
					tapOutActionSelectorTimeoutRef.current = setTimeout(() => {
						setTapOutActionSelection(null);
					}, TAP_OUT_ACTION_TIMEOUT_MS);
					return;
				}

				if (
					result.status === "agreements_required" &&
					result.missingAgreements
				) {
					setIsProcessing(false);
					setPendingAgreement({
						cardNumber,
						userName: result.user.name,
						agreements: result.missingAgreements,
					});
					agreementFlowTimeoutRef.current = setTimeout(() => {
						setPendingAgreement(null);
						showError("Entry denied. Complete all agreements to tap in.");
					}, AGREEMENT_FLOW_TIMEOUT_MS);
					return;
				}

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
								} satisfies TapEvent)
							: result.session
								? ({
										status: result.status as "tapped_in" | "tapped_out",
										user: result.user,
										session: result.session,
										id: crypto.randomUUID(),
										timestamp: new Date(),
									} satisfies TapEvent)
								: null;

					if (!event) {
						showError("Unexpected response from server");
						return;
					}

					clearTimer(tapEventTimeoutRef);
					clearTimer(exitTimeoutRef);

					if (currentTapEventRef.current) {
						setIsNotificationExiting(true);
						exitTimeoutRef.current = setTimeout(() => {
							setIsNotificationExiting(false);
							setCurrentTapEvent(event);
							scheduleEventHide();
						}, FADE_OUT_TRIGGER_DELAY_MS);
					} else {
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
		},
		[log, showError],
	);

	const handleAgreementComplete = useCallback(async () => {
		if (!pendingAgreement) return;

		clearTimer(agreementFlowTimeoutRef);

		try {
			await handleTapInOut(pendingAgreement.cardNumber);
		} finally {
			setPendingAgreement(null);
		}
	}, [handleTapInOut, pendingAgreement]);

	const handleAgreementCancel = useCallback(() => {
		clearTimer(agreementFlowTimeoutRef);
		setPendingAgreement(null);
		showError("Entry denied. Complete all agreements to tap in.");
	}, [showError]);

	const handleAgreementError = useCallback(
		(message: string) => {
			showError(message);
		},
		[showError],
	);

	const handleSessionTypeSelect = useCallback(
		async (type: "regular" | "staffing") => {
			const selection = sessionTypeSelection;
			if (!selection) return;

			clearTimer(sessionTypeSelectorTimeoutRef);

			try {
				await handleTapInOut(selection.cardNumber, type);
			} finally {
				setSessionTypeSelection(null);
			}
		},
		[handleTapInOut, sessionTypeSelection],
	);

	const handleSessionTypeCancel = useCallback(() => {
		clearTimer(sessionTypeSelectorTimeoutRef);
		setSessionTypeSelection(null);
	}, []);

	const handleTapOutActionSelect = useCallback(
		async (
			action: "end_session" | "switch_to_staffing" | "switch_to_regular",
		) => {
			const selection = tapOutActionSelection;
			if (!selection) return;

			clearTimer(tapOutActionSelectorTimeoutRef);

			try {
				await handleTapInOut(selection.cardNumber, undefined, action);
			} finally {
				setTapOutActionSelection(null);
			}
		},
		[handleTapInOut, tapOutActionSelection],
	);

	const handleTapOutActionCancel = useCallback(() => {
		clearTimer(tapOutActionSelectorTimeoutRef);
		setTapOutActionSelection(null);
	}, []);

	useEffect(() => {
		return () => {
			clearTimer(tapEventTimeoutRef);
			clearTimer(exitTimeoutRef);
			clearTimer(errorTimeoutRef);
			clearTimer(errorExitTimeoutRef);
			clearTimer(sessionTypeSelectorTimeoutRef);
			clearTimer(tapOutActionSelectorTimeoutRef);
			clearTimer(agreementFlowTimeoutRef);
		};
	}, []);

	return {
		isProcessing,
		pendingAgreement,
		sessionTypeSelection,
		tapOutActionSelection,
		tapNotification: {
			event: currentTapEvent,
			isExiting: isNotificationExiting,
		},
		errorDialog: {
			message: errorMessage,
			isExiting: isErrorExiting,
		},
		handleTap: handleTapInOut,
		handleAgreementComplete,
		handleAgreementCancel,
		handleAgreementError,
		handleSessionTypeSelect,
		handleSessionTypeCancel,
		handleTapOutActionSelect,
		handleTapOutActionCancel,
		resetAgreementTimeout,
		showError,
	};
}
