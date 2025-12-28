import { trpc } from "@ecehive/trpc/client";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { formatLog, getLogger } from "@/lib/logging";
import type { TapEvent } from "@/types";

const SESSION_TYPE_TIMEOUT_MS = 15000;
const TAP_OUT_ACTION_TIMEOUT_MS = 15000;
const AGREEMENT_FLOW_TIMEOUT_MS = 30000;
const NOTIFICATION_DISPLAY_DURATION_MS = 1500;
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

export type OneTimeLoginState = {
	code: string;
	expiresAt: Date;
};

type TapWorkflowState = {
	isProcessing: boolean;
	pendingAgreement: PendingAgreementState | null;
	sessionTypeSelection: SessionTypeSelectionState | null;
	tapOutActionSelection: TapOutActionSelectionState | null;
	tapNotification: TapNotificationState;
	errorDialog: ErrorDialogState;
	oneTimeLogin: OneTimeLoginState | null;
};

type TapWorkflowAction =
	| { type: "processing_start" }
	| { type: "processing_end" }
	| { type: "pending_agreement_set"; payload: PendingAgreementState }
	| { type: "pending_agreement_clear" }
	| { type: "session_type_set"; payload: SessionTypeSelectionState }
	| { type: "session_type_clear" }
	| { type: "tap_out_action_set"; payload: TapOutActionSelectionState }
	| { type: "tap_out_action_clear" }
	| { type: "tap_notification_set"; payload: TapEvent }
	| { type: "tap_notification_clear" }
	| { type: "tap_notification_exit_start" }
	| { type: "error_show"; payload: string }
	| { type: "error_clear" }
	| { type: "error_exit_start" }
	| { type: "one_time_login_set"; payload: OneTimeLoginState }
	| { type: "one_time_login_clear" };

const INITIAL_STATE: TapWorkflowState = {
	isProcessing: false,
	pendingAgreement: null,
	sessionTypeSelection: null,
	tapOutActionSelection: null,
	tapNotification: {
		event: null,
		isExiting: false,
	},
	errorDialog: {
		message: "",
		isExiting: false,
	},
	oneTimeLogin: null,
};

const tapWorkflowReducer = (
	state: TapWorkflowState,
	action: TapWorkflowAction,
): TapWorkflowState => {
	switch (action.type) {
		case "processing_start":
			return { ...state, isProcessing: true };
		case "processing_end":
			return { ...state, isProcessing: false };
		case "pending_agreement_set":
			return { ...state, pendingAgreement: action.payload };
		case "pending_agreement_clear":
			return { ...state, pendingAgreement: null };
		case "session_type_set":
			return { ...state, sessionTypeSelection: action.payload };
		case "session_type_clear":
			return { ...state, sessionTypeSelection: null };
		case "tap_out_action_set":
			return { ...state, tapOutActionSelection: action.payload };
		case "tap_out_action_clear":
			return { ...state, tapOutActionSelection: null };
		case "tap_notification_set":
			return {
				...state,
				tapNotification: {
					event: action.payload,
					isExiting: false,
				},
			};
		case "tap_notification_exit_start":
			return {
				...state,
				tapNotification: {
					...state.tapNotification,
					isExiting: true,
				},
			};
		case "tap_notification_clear":
			return {
				...state,
				tapNotification: {
					event: null,
					isExiting: false,
				},
			};
		case "error_show":
			return {
				...state,
				errorDialog: {
					message: action.payload,
					isExiting: false,
				},
			};
		case "error_exit_start":
			return {
				...state,
				errorDialog: {
					...state.errorDialog,
					isExiting: true,
				},
			};
		case "error_clear":
			return {
				...state,
				errorDialog: {
					message: "",
					isExiting: false,
				},
			};
		case "one_time_login_set":
			return { ...state, oneTimeLogin: action.payload };
		case "one_time_login_clear":
			return { ...state, oneTimeLogin: null };
		default:
			return state;
	}
};

const clearTimer = (ref: RefObject<NodeJS.Timeout | null>) => {
	if (ref.current) {
		clearTimeout(ref.current);
		ref.current = null;
	}
};

export function useTapWorkflow() {
	const log = useMemo(() => getLogger("app"), []);
	const [state, dispatch] = useReducer(tapWorkflowReducer, INITIAL_STATE);
	const {
		isProcessing,
		pendingAgreement,
		sessionTypeSelection,
		tapOutActionSelection,
		tapNotification,
		errorDialog,
		oneTimeLogin,
	} = state;

	const currentTapEventRef = useRef<TapEvent | null>(null);
	useEffect(() => {
		currentTapEventRef.current = tapNotification.event;
	}, [tapNotification.event]);

	const tapEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const sessionTypeSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const tapOutActionSelectorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const agreementFlowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const dismissTapNotification = useCallback(() => {
		clearTimer(tapEventTimeoutRef);
		clearTimer(exitTimeoutRef);
		dispatch({ type: "tap_notification_clear" });
	}, [dispatch]);

	const scheduleEventHide = useCallback(() => {
		clearTimer(tapEventTimeoutRef);
		tapEventTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "tap_notification_exit_start" });
			exitTimeoutRef.current = setTimeout(() => {
				dispatch({ type: "tap_notification_clear" });
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, [dispatch]);

	const scheduleErrorHide = useCallback(() => {
		errorTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "error_exit_start" });
			errorExitTimeoutRef.current = setTimeout(() => {
				dispatch({ type: "error_clear" });
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, [dispatch]);

	const showError = useCallback(
		(message: string) => {
			clearTimer(errorTimeoutRef);
			clearTimer(errorExitTimeoutRef);

			if (errorDialog.message) {
				dispatch({ type: "error_exit_start" });
				errorExitTimeoutRef.current = setTimeout(() => {
					dispatch({ type: "error_show", payload: message });
					scheduleErrorHide();
				}, FADE_OUT_TRIGGER_DELAY_MS);
			} else {
				dispatch({ type: "error_show", payload: message });
				scheduleErrorHide();
			}
		},
		[dispatch, errorDialog.message, scheduleErrorHide],
	);

	const resetAgreementTimeout = useCallback(() => {
		clearTimer(agreementFlowTimeoutRef);
		agreementFlowTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "pending_agreement_clear" });
			showError("Entry denied. Complete all agreements to tap in.");
		}, AGREEMENT_FLOW_TIMEOUT_MS);
	}, [dispatch, showError]);

	const handleTapInOut = useCallback(
		async (
			cardNumber: string,
			sessionType?: "regular" | "staffing",
			tapAction?: "end_session" | "switch_to_staffing" | "switch_to_regular",
		) => {
			dismissTapNotification();
			clearTimer(sessionTypeSelectorTimeoutRef);
			clearTimer(tapOutActionSelectorTimeoutRef);
			clearTimer(agreementFlowTimeoutRef);
			dispatch({ type: "session_type_clear" });
			dispatch({ type: "tap_out_action_clear" });
			dispatch({ type: "pending_agreement_clear" });
			dispatch({ type: "processing_start" });

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
					dispatch({ type: "processing_end" });
					dispatch({
						type: "session_type_set",
						payload: {
							cardNumber,
							userName: result.user.name,
						},
					});
					sessionTypeSelectorTimeoutRef.current = setTimeout(() => {
						dispatch({ type: "session_type_clear" });
					}, SESSION_TYPE_TIMEOUT_MS);
					return;
				}

				if (result.status === "choose_tap_out_action") {
					dispatch({ type: "processing_end" });
					dispatch({
						type: "tap_out_action_set",
						payload: {
							cardNumber,
							userName: result.user.name,
							currentSessionType:
								result.currentSession?.sessionType || "regular",
						},
					});
					tapOutActionSelectorTimeoutRef.current = setTimeout(() => {
						dispatch({ type: "tap_out_action_clear" });
					}, TAP_OUT_ACTION_TIMEOUT_MS);
					return;
				}

				if (
					result.status === "agreements_required" &&
					result.missingAgreements
				) {
					dispatch({ type: "processing_end" });
					dispatch({
						type: "pending_agreement_set",
						payload: {
							cardNumber,
							userName: result.user.name,
							agreements: result.missingAgreements,
						},
					});
					agreementFlowTimeoutRef.current = setTimeout(() => {
						dispatch({ type: "pending_agreement_clear" });
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
					dispatch({ type: "processing_end" });
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
						dispatch({ type: "tap_notification_exit_start" });
						exitTimeoutRef.current = setTimeout(() => {
							dispatch({ type: "tap_notification_set", payload: event });
							scheduleEventHide();
						}, FADE_OUT_TRIGGER_DELAY_MS);
					} else {
						dispatch({ type: "tap_notification_set", payload: event });
						scheduleEventHide();
					}
				}
			} catch (error: unknown) {
				dispatch({ type: "processing_end" });
				const message =
					error instanceof Error ? error.message : "Failed to process tap";
				log.error(formatLog("Tap failed", { error: message }));
				showError(message);
			}
		},
		[dismissTapNotification, log, scheduleEventHide, showError],
	);

	const handleAgreementComplete = useCallback(async () => {
		if (!pendingAgreement) return;

		clearTimer(agreementFlowTimeoutRef);

		try {
			await handleTapInOut(pendingAgreement.cardNumber);
		} finally {
			dispatch({ type: "pending_agreement_clear" });
		}
	}, [dispatch, handleTapInOut, pendingAgreement]);

	const handleAgreementCancel = useCallback(() => {
		clearTimer(agreementFlowTimeoutRef);
		dispatch({ type: "pending_agreement_clear" });
		showError("Entry denied. Complete all agreements to tap in.");
	}, [dispatch, showError]);

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
				dispatch({ type: "session_type_clear" });
			}
		},
		[dispatch, handleTapInOut, sessionTypeSelection],
	);

	const handleSessionTypeCancel = useCallback(() => {
		clearTimer(sessionTypeSelectorTimeoutRef);
		dispatch({ type: "session_type_clear" });
	}, [dispatch]);

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
				dispatch({ type: "tap_out_action_clear" });
			}
		},
		[dispatch, handleTapInOut, tapOutActionSelection],
	);

	const handleTapOutActionCancel = useCallback(() => {
		clearTimer(tapOutActionSelectorTimeoutRef);
		dispatch({ type: "tap_out_action_clear" });
	}, [dispatch]);

	const handleLoginWithoutCard = useCallback(async () => {
		dispatch({ type: "processing_start" });
		try {
			const result = await trpc.oneTimeLoginCodes.generate.mutate({});
			dispatch({
				type: "one_time_login_set",
				payload: {
					code: result.code,
					expiresAt: result.expiresAt,
				},
			});
		} catch (error) {
			logger.error(
				formatLog({
					action: "handleLoginWithoutCard",
					success: false,
					error,
				}),
			);
			showError("Failed to generate login code. Please try again.");
		} finally {
			dispatch({ type: "processing_end" });
		}
	}, [dispatch, showError]);

	const handleLoginWithoutCardCancel = useCallback(() => {
		dispatch({ type: "one_time_login_clear" });
	}, [dispatch]);

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
		tapNotification,
		errorDialog,
		oneTimeLogin,
		handleTap: handleTapInOut,
		handleAgreementComplete,
		handleAgreementCancel,
		handleAgreementError,
		handleSessionTypeSelect,
		handleSessionTypeCancel,
		handleTapOutActionSelect,
		handleTapOutActionCancel,
		handleLoginWithoutCard,
		handleLoginWithoutCardCancel,
		resetAgreementTimeout,
		showError,
		dismissTapNotification,
	};
}
