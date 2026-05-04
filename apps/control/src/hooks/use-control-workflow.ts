import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { logger } from "../lib/logging";
import { calculateReadingDuration } from "../lib/utils";
import type { ControlPointWithStatus } from "../types";

interface AuthenticatedUser {
	id: string;
	name: string;
	cardNumber: string;
	authorizedControlPointIds: string[];
	managedControlPointIds: string[];
	hasStaffingPermission: boolean;
	currentSession: {
		id: number;
		sessionType: "regular" | "staffing";
	} | null;
}

export type SessionAction =
	| "start_regular"
	| "start_staffing"
	| "end_session"
	| "switch_to_regular"
	| "switch_to_staffing";

export interface ConfirmationState {
	action: SessionAction;
	title: string;
	message: string;
	confirmText: string;
	variant: "warning" | "danger" | "info";
}

interface ControlKioskState {
	mode: "idle" | "processing" | "authenticated" | "success" | "error";
	authenticatedUser: AuthenticatedUser | null;
	error: string | null;
	showSessionSelection: boolean;
	operatingPointId: string | null; // Track which control point is being operated
	pendingConfirmation: ConfirmationState | null; // Track pending confirmation dialog
	selectedControlPoint: ControlPointWithStatus | null;
	trainingControlPoint: ControlPointWithStatus | null;
	trainingStatusMessage: string | null;
	trainingStatusType: "success" | "error" | null;
	lastTrainedUserName: string | null;
	controlLogsPoint: ControlPointWithStatus | null;
}

type ControlLogEntry = {
	id: string;
	action: "login" | "logout";
	createdAt: Date;
	userName: string;
};

interface UseControlWorkflowOptions {
	onSuccess?: (message: string) => void;
	onError?: (message: string) => void;
}

export function useControlWorkflow(options: UseControlWorkflowOptions = {}) {
	const { onSuccess, onError } = options;
	const queryClient = useQueryClient();

	const [state, setState] = useState<ControlKioskState>({
		mode: "idle",
		authenticatedUser: null,
		error: null,
		showSessionSelection: false,
		operatingPointId: null,
		pendingConfirmation: null,
		selectedControlPoint: null,
		trainingControlPoint: null,
		trainingStatusMessage: null,
		trainingStatusType: null,
		lastTrainedUserName: null,
		controlLogsPoint: null,
	});

	// Get control points available on this device
	const controlPointsQuery = useQuery({
		queryKey: ["controlKiosk", "controlPoints"],
		queryFn: () => trpc.controlKiosk.getControlPoints.query({}),
		refetchInterval: 5000, // Refetch every 5 seconds for status updates
	});

	const controlLogsQuery = useQuery({
		queryKey: ["controlKiosk", "controlLogs", state.controlLogsPoint?.id],
		queryFn: async () => {
			if (!state.controlLogsPoint) {
				return { logs: [] };
			}

			return trpc.controlKiosk.getControlLogs.query({
				controlPointId: state.controlLogsPoint.id,
				limit: 50,
			});
		},
		enabled: !!state.controlLogsPoint,
	});

	// Check user permissions mutation
	const checkPermissionsMutation = useMutation({
		mutationFn: (input: { cardNumber: string }) =>
			trpc.controlKiosk.checkUserPermissions.query(input),
		onSuccess: (data, variables) => {
			if (
				data.authorizedControlPoints.length === 0 &&
				data.managedControlPoints.length === 0
			) {
				const errorMsg =
					"You don't have permission to control any points on this device";
				setState((prev) => ({
					...prev,
					mode: "error",
					error: errorMsg,
				}));
				onError?.(errorMsg);
				setTimeout(() => resetToIdle(), calculateReadingDuration(errorMsg));
			} else {
				setState((prev) => ({
					...prev,
					mode: "authenticated",
					authenticatedUser: {
						id: String(data.user.id),
						name: data.user.name || "Unknown User",
						cardNumber: variables.cardNumber,
						authorizedControlPointIds: data.authorizedControlPoints.map(
							(p) => p.id,
						),
						managedControlPointIds: data.managedControlPoints.map((p) => p.id),
						hasStaffingPermission: data.hasStaffingPermission,
						currentSession: data.currentSession
							? {
									id: data.currentSession.id,
									sessionType: data.currentSession.sessionType as
										| "regular"
										| "staffing",
								}
							: null,
					},
					error: null,
				}));
			}
		},
		onError: (error: Error) => {
			logger.error("Failed to check permissions:", error);
			const errorMsg = error.message || "Failed to verify permissions";
			setState((prev) => ({
				...prev,
				mode: "error",
				error: errorMsg,
			}));
			onError?.(errorMsg);
			setTimeout(() => resetToIdle(), calculateReadingDuration(errorMsg));
		},
	});

	// Operate control point mutation
	const operateMutation = useMutation({
		mutationFn: (input: {
			controlPointId: string;
			cardNumber: string;
			action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
		}) => trpc.controlKiosk.operate.mutate(input),
		onSuccess: () => {
			logger.info("Control point operation successful");
			// Clear operating point - stay in authenticated mode
			setState((prev) => ({
				...prev,
				operatingPointId: null,
			}));
			onSuccess?.("Operation completed successfully");
			// Invalidate control points to refresh status
			queryClient.invalidateQueries({
				queryKey: ["controlKiosk", "controlPoints"],
			});
		},
		onError: (error: Error) => {
			logger.error("Control point operation failed:", error);
			const errorMsg = error.message || "Operation failed";
			setState((prev) => ({
				...prev,
				operatingPointId: null,
				error: errorMsg,
			}));
			onError?.(errorMsg);
			// Clear error after showing it
			setTimeout(
				() =>
					setState((prev) => ({
						...prev,
						error: null,
					})),
				calculateReadingDuration(errorMsg),
			);
		},
	});

	const updatePointMutation = useMutation({
		mutationFn: (input: {
			id: string;
			isActive: boolean;
			cardNumber: string;
		}) =>
			trpc.controlKiosk.updatePoint.mutate({
				cardNumber: input.cardNumber,
				controlPointId: input.id,
				isActive: input.isActive,
			}),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["controlKiosk", "controlPoints"],
			});
			setState((prev) => ({
				...prev,
				selectedControlPoint:
					prev.selectedControlPoint &&
					prev.selectedControlPoint.id === variables.id
						? {
								...prev.selectedControlPoint,
								isActive: variables.isActive,
							}
						: prev.selectedControlPoint,
			}));
			onSuccess?.("Control point updated successfully");
		},
		onError: (error: Error) => {
			logger.error("Failed to update control point:", error);
			const errorMsg = error.message || "Failed to update control point";
			setState((prev) => ({ ...prev, error: errorMsg }));
			onError?.(errorMsg);
			setTimeout(
				() => setState((prev) => ({ ...prev, error: null })),
				calculateReadingDuration(errorMsg),
			);
		},
	});

	const trainUserMutation = useMutation({
		mutationFn: (input: {
			controlPointId: string;
			trainerCardNumber: string;
			traineeCardNumber: string;
		}) => trpc.controlKiosk.trainUser.mutate(input),
		onSuccess: (data) => {
			setState((prev) => ({
				...prev,
				lastTrainedUserName: data.userName,
				trainingStatusMessage: null,
				trainingStatusType: "success",
			}));
		},
		onError: (error: Error) => {
			const errorMsg = error.message || "Failed to train user";
			setState((prev) => ({
				...prev,
				trainingStatusMessage: errorMsg,
				trainingStatusType: "error",
			}));
		},
	});

	// Tap in/out mutation for session management
	const tapInOutMutation = useMutation({
		mutationFn: (input: {
			cardNumber: string;
			sessionType?: "regular" | "staffing";
			tapAction?: "end_session" | "switch_to_staffing" | "switch_to_regular";
		}) => trpc.controlKiosk.tapInOut.mutate(input),
		onSuccess: (data) => {
			logger.info("Session action successful:", data.status);

			// Update the authenticated user's session state
			if (
				data.status === "tapped_in" ||
				data.status === "switched_to_staffing" ||
				data.status === "switched_to_regular"
			) {
				const newSession =
					"session" in data
						? data.session
						: "newSession" in data
							? data.newSession
							: null;
				setState((prev) => ({
					...prev,
					mode: "success",
					showSessionSelection: false,
					authenticatedUser: prev.authenticatedUser
						? {
								...prev.authenticatedUser,
								currentSession: newSession
									? {
											id: newSession.id,
											sessionType: newSession.sessionType as
												| "regular"
												| "staffing",
										}
									: null,
							}
						: null,
				}));
			} else if (data.status === "tapped_out") {
				setState((prev) => ({
					...prev,
					mode: "success",
					showSessionSelection: false,
					authenticatedUser: prev.authenticatedUser
						? {
								...prev.authenticatedUser,
								currentSession: null,
							}
						: null,
				}));
			}

			onSuccess?.("Session updated successfully");

			// Return to authenticated state
			setTimeout(
				() =>
					setState((prev) => ({
						...prev,
						mode: "authenticated",
					})),
				1500,
			);
		},
		onError: (error: Error) => {
			logger.error("Session action failed:", error);
			const errorMsg = error.message || "Session action failed";
			setState((prev) => ({
				...prev,
				mode: "error",
				error: errorMsg,
				showSessionSelection: false,
			}));
			onError?.(errorMsg);
			setTimeout(
				() =>
					setState((prev) => ({
						...prev,
						mode: "authenticated",
						error: null,
					})),
				calculateReadingDuration(errorMsg),
			);
		},
	});

	const handleCardScan = useCallback(
		async (cardNumber: string) => {
			logger.info("Card scanned for control access");

			// Authenticate the user
			setState((prev) => ({
				...prev,
				mode: "processing",
				authenticatedUser: null,
				error: null,
				showSessionSelection: false,
				operatingPointId: null,
				pendingConfirmation: null,
				selectedControlPoint: null,
				trainingControlPoint: null,
				trainingStatusMessage: null,
				trainingStatusType: null,
				lastTrainedUserName: null,
				controlLogsPoint: null,
			}));

			checkPermissionsMutation.mutate({ cardNumber });
		},
		[checkPermissionsMutation],
	);

	const operateControlPoint = useCallback(
		(controlPoint: ControlPointWithStatus) => {
			if (state.mode !== "authenticated" || !state.authenticatedUser) {
				return;
			}

			// Check if user is authorized for this control point
			if (
				!state.authenticatedUser.authorizedControlPointIds.includes(
					controlPoint.id,
				)
			) {
				onError?.("You are not authorized to control this point");
				return;
			}

			// Track which point is being operated (no mode change, so no fullscreen overlay)
			setState((prev) => ({ ...prev, operatingPointId: controlPoint.id }));

			// Determine action based on control class and current state
			const action: "TURN_ON" | "TURN_OFF" | "UNLOCK" =
				controlPoint.controlClass === "DOOR"
					? "UNLOCK"
					: controlPoint.currentState
						? "TURN_OFF"
						: "TURN_ON";

			operateMutation.mutate({
				controlPointId: controlPoint.id,
				cardNumber: state.authenticatedUser.cardNumber,
				action,
			});
		},
		[state.mode, state.authenticatedUser, operateMutation, onError],
	);

	const resetToIdle = useCallback(() => {
		setState((prev) => ({
			...prev,
			mode: "idle",
			authenticatedUser: null,
			error: null,
			showSessionSelection: false,
			operatingPointId: null,
			pendingConfirmation: null,
			selectedControlPoint: null,
			trainingControlPoint: null,
			trainingStatusMessage: null,
			trainingStatusType: null,
			lastTrainedUserName: null,
			controlLogsPoint: null,
		}));
	}, []);

	const logout = useCallback(() => {
		logger.info("User logged out from control kiosk");
		resetToIdle();
	}, [resetToIdle]);

	const startManagingControlPoint = useCallback(
		(controlPoint: ControlPointWithStatus) => {
			setState((prev) => ({ ...prev, selectedControlPoint: controlPoint }));
		},
		[],
	);

	const stopManagingControlPoint = useCallback(() => {
		setState((prev) => ({
			...prev,
			selectedControlPoint: null,
			trainingControlPoint: null,
			trainingStatusMessage: null,
			trainingStatusType: null,
			lastTrainedUserName: null,
			controlLogsPoint: null,
		}));
	}, []);

	const openControlLogsDialog = useCallback(
		(controlPoint: ControlPointWithStatus) => {
			setState((prev) => ({
				...prev,
				controlLogsPoint: controlPoint,
			}));
		},
		[],
	);

	const closeControlLogsDialog = useCallback(() => {
		setState((prev) => ({
			...prev,
			controlLogsPoint: null,
		}));
	}, []);

	const openTrainingDialog = useCallback(
		(controlPoint: ControlPointWithStatus) => {
			setState((prev) => ({
				...prev,
				trainingControlPoint: controlPoint,
				trainingStatusMessage: null,
				trainingStatusType: null,
				lastTrainedUserName: null,
			}));
		},
		[],
	);

	const closeTrainingDialog = useCallback(() => {
		setState((prev) => ({
			...prev,
			trainingControlPoint: null,
			trainingStatusMessage: null,
			trainingStatusType: null,
			lastTrainedUserName: null,
		}));
	}, []);

	const handleTrainingCardScan = useCallback(
		(cardNumber: string) => {
			if (!state.authenticatedUser || !state.trainingControlPoint) {
				return;
			}

			setState((prev) => ({
				...prev,
				trainingStatusMessage: null,
				trainingStatusType: null,
			}));

			trainUserMutation.mutate({
				controlPointId: state.trainingControlPoint.id,
				trainerCardNumber: state.authenticatedUser.cardNumber,
				traineeCardNumber: cardNumber,
			});
		},
		[state.authenticatedUser, state.trainingControlPoint, trainUserMutation],
	);

	const toggleControlPointActive = useCallback(
		(controlPoint: ControlPointWithStatus) => {
			if (state.mode !== "authenticated" || !state.authenticatedUser) {
				return;
			}

			updatePointMutation.mutate({
				id: controlPoint.id,
				isActive: !controlPoint.isActive,
				cardNumber: state.authenticatedUser.cardNumber,
			});
		},
		[state.mode, state.authenticatedUser, updatePointMutation],
	);

	const showSessionSelection = useCallback(() => {
		setState((prev) => ({ ...prev, showSessionSelection: true }));
	}, []);

	const hideSessionSelection = useCallback(() => {
		setState((prev) => ({
			...prev,
			showSessionSelection: false,
			pendingConfirmation: null,
		}));
	}, []);

	// Get confirmation config for session actions
	const getConfirmationConfig = useCallback(
		(action: SessionAction): ConfirmationState | null => {
			const isStaffing =
				state.authenticatedUser?.currentSession?.sessionType === "staffing";

			switch (action) {
				case "end_session":
					if (isStaffing) {
						return {
							action,
							title: "End Staffing Session?",
							message:
								"You are currently on a staffing shift. If you leave now, you may not receive full credit for your attendance.",
							confirmText: "Yes, Leave",
							variant: "danger",
						};
					}
					return {
						action,
						title: "End Session?",
						message: "Are you sure you want to end your current session?",
						confirmText: "Yes, Leave",
						variant: "warning",
					};
				case "switch_to_regular":
					if (isStaffing) {
						return {
							action,
							title: "Switch to Regular?",
							message:
								"You are currently on a staffing shift. If you switch now, you will leave your shift early and may not receive full credit.",
							confirmText: "Yes, Switch",
							variant: "danger",
						};
					}
					return null;
				case "switch_to_staffing":
					return {
						action,
						title: "Switch to Staffing?",
						message:
							"Are you sure you want to end your regular session and start a staffing shift?",
						confirmText: "Yes, Switch",
						variant: "warning",
					};
				case "start_regular":
				case "start_staffing":
					// No confirmation needed for starting sessions
					return null;
				default:
					return null;
			}
		},
		[state.authenticatedUser],
	);

	// Request confirmation for an action
	const requestSessionAction = useCallback(
		(action: SessionAction) => {
			const confirmationConfig = getConfirmationConfig(action);
			if (confirmationConfig) {
				setState((prev) => ({
					...prev,
					pendingConfirmation: confirmationConfig,
				}));
			} else {
				// No confirmation needed, execute directly
				executeSessionAction(action);
			}
		},
		[getConfirmationConfig],
	);

	// Cancel pending confirmation
	const cancelConfirmation = useCallback(() => {
		setState((prev) => ({ ...prev, pendingConfirmation: null }));
	}, []);

	// Confirm and execute pending action
	const confirmAction = useCallback(() => {
		if (state.pendingConfirmation) {
			executeSessionAction(state.pendingConfirmation.action);
		}
	}, [state.pendingConfirmation]);

	// Execute session action (internal)
	const executeSessionAction = useCallback(
		(action: SessionAction) => {
			if (!state.authenticatedUser) return;

			// Hide session selection and clear confirmation, show processing
			setState((prev) => ({
				...prev,
				mode: "processing",
				showSessionSelection: false,
				pendingConfirmation: null,
			}));

			const cardNumber = state.authenticatedUser.cardNumber;

			switch (action) {
				case "start_regular":
					tapInOutMutation.mutate({ cardNumber, sessionType: "regular" });
					break;
				case "start_staffing":
					tapInOutMutation.mutate({ cardNumber, sessionType: "staffing" });
					break;
				case "end_session":
					tapInOutMutation.mutate({ cardNumber, tapAction: "end_session" });
					break;
				case "switch_to_regular":
					tapInOutMutation.mutate({
						cardNumber,
						tapAction: "switch_to_regular",
					});
					break;
				case "switch_to_staffing":
					tapInOutMutation.mutate({
						cardNumber,
						tapAction: "switch_to_staffing",
					});
					break;
			}
		},
		[state.authenticatedUser, tapInOutMutation],
	);

	// Legacy function for backward compatibility
	const handleSessionAction = useCallback(
		(action: SessionAction) => {
			requestSessionAction(action);
		},
		[requestSessionAction],
	);

	return {
		state,
		controlPoints: (controlPointsQuery.data?.controlPoints ??
			[]) as ControlPointWithStatus[],
		controlLogs: (controlLogsQuery.data?.logs ?? []) as ControlLogEntry[],
		isLoading: controlPointsQuery.isLoading,
		isControlLogsLoading: controlLogsQuery.isLoading,
		isProcessing:
			checkPermissionsMutation.isPending ||
			operateMutation.isPending ||
			tapInOutMutation.isPending,
		handleCardScan,
		handleTrainingCardScan,
		operateControlPoint,
		logout,
		resetToIdle,
		showSessionSelection,
		hideSessionSelection,
		handleSessionAction,
		requestSessionAction,
		cancelConfirmation,
		confirmAction,
		refetchControlPoints: () =>
			queryClient.invalidateQueries({
				queryKey: ["controlKiosk", "controlPoints"],
			}),
		selectedControlPoint: state.selectedControlPoint,
		startManagingControlPoint,
		stopManagingControlPoint,
		toggleControlPointActive,
		isUpdatingControlPoint: updatePointMutation.isPending,
		trainingControlPoint: state.trainingControlPoint,
		trainingStatusMessage: state.trainingStatusMessage,
		trainingStatusType: state.trainingStatusType,
		lastTrainedUserName: state.lastTrainedUserName,
		openTrainingDialog,
		closeTrainingDialog,
		isTrainingUser: trainUserMutation.isPending,
		controlLogsPoint: state.controlLogsPoint,
		openControlLogsDialog,
		closeControlLogsDialog,
	};
}
