import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { logger } from "../lib/logging";
import type { ControlPointWithStatus } from "../types";

interface AuthenticatedUser {
	id: string;
	name: string;
	cardNumber: string;
	authorizedControlPointIds: string[];
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
}

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
	});

	// Get control points available on this device
	const controlPointsQuery = useQuery({
		queryKey: ["controlKiosk", "controlPoints"],
		queryFn: () => trpc.controlKiosk.getControlPoints.query({}),
		refetchInterval: 5000, // Refetch every 5 seconds for status updates
	});

	// Check user permissions mutation
	const checkPermissionsMutation = useMutation({
		mutationFn: (input: { cardNumber: string }) =>
			trpc.controlKiosk.checkUserPermissions.query(input),
		onSuccess: (data, variables) => {
			if (data.authorizedControlPoints.length === 0) {
				setState((prev) => ({
					...prev,
					mode: "error",
					error:
						"You don't have permission to control any points on this device",
				}));
				onError?.(
					"You don't have permission to control any points on this device",
				);
				setTimeout(() => resetToIdle(), 3000);
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
			setState((prev) => ({
				...prev,
				mode: "error",
				error: error.message || "Failed to verify permissions",
			}));
			onError?.(error.message || "Failed to verify permissions");
			setTimeout(() => resetToIdle(), 3000);
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
			setState((prev) => ({
				...prev,
				operatingPointId: null,
				error: error.message || "Operation failed",
			}));
			onError?.(error.message || "Operation failed");
			// Clear error after showing it
			setTimeout(
				() =>
					setState((prev) => ({
						...prev,
						error: null,
					})),
				3000,
			);
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
			setState((prev) => ({
				...prev,
				mode: "error",
				error: error.message || "Session action failed",
				showSessionSelection: false,
			}));
			onError?.(error.message || "Session action failed");
			setTimeout(
				() =>
					setState((prev) => ({
						...prev,
						mode: "authenticated",
						error: null,
					})),
				3000,
			);
		},
	});

	const handleCardScan = useCallback(
		async (cardNumber: string) => {
			logger.info("Card scanned for control access");

			// Authenticate the user
			setState({
				mode: "processing",
				authenticatedUser: null,
				error: null,
				showSessionSelection: false,
				operatingPointId: null,
				pendingConfirmation: null,
			});

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
		setState({
			mode: "idle",
			authenticatedUser: null,
			error: null,
			showSessionSelection: false,
			operatingPointId: null,
			pendingConfirmation: null,
		});
	}, []);

	const logout = useCallback(() => {
		logger.info("User logged out from control kiosk");
		resetToIdle();
	}, [resetToIdle]);

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
		isLoading: controlPointsQuery.isLoading,
		isProcessing:
			checkPermissionsMutation.isPending ||
			operateMutation.isPending ||
			tapInOutMutation.isPending,
		handleCardScan,
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
	};
}
