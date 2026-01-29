import { trpc } from "@ecehive/trpc/client";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { formatLog, getLogger } from "@/lib/logging";
import type { RestrictedItem } from "@/components/approval-dialog";

// Agreements are not used in the inventory kiosk
const NOTIFICATION_DISPLAY_DURATION_MS = 1500;
const FADE_OUT_DURATION_MS = 300;
const FADE_OUT_TRIGGER_DELAY_MS = 200;

// Agreement-related types removed

export type ErrorDialogState = {
	message: string;
	isExiting: boolean;
};

export type ScanNotificationState = {
	userName: string;
	isExiting: boolean;
};

export type SuccessNotificationState = {
	message: string;
	isExiting: boolean;
};

// One-time login removed for inventory kiosk

export type SuspensionState = {
	userName: string;
	endDate: Date;
	externalNotes: string | null;
	isExiting: boolean;
};

export type TransactionViewState = {
	userName: string;
	cardNumber: string;
	canReturn: boolean;
	userId: number;
};

export type ApprovalDialogState = {
	restrictedItems: RestrictedItem[];
	pendingTransaction: {
		type: "checkout" | "return";
		items: { itemId: string; quantity: number }[];
		userId: number;
	};
	isProcessing: boolean;
	approverName?: string;
	error?: string;
};

type InventoryWorkflowState = {
	isProcessing: boolean;
	scanNotification: ScanNotificationState | null;
	successNotification: SuccessNotificationState | null;
	errorDialog: ErrorDialogState;
	suspension: SuspensionState | null;
	transactionView: TransactionViewState | null;
	approvalDialog: ApprovalDialogState | null;
};

type InventoryWorkflowAction =
	| { type: "processing_start" }
	| { type: "processing_end" }
	| { type: "scan_notification_set"; payload: { userName: string } }
	| { type: "scan_notification_clear" }
	| { type: "scan_notification_exit_start" }
	| { type: "success_notification_set"; payload: { message: string } }
	| { type: "success_notification_clear" }
	| { type: "success_notification_exit_start" }
	| { type: "error_show"; payload: string }
	| { type: "error_clear" }
	| { type: "error_exit_start" }
	| { type: "suspension_set"; payload: Omit<SuspensionState, "isExiting"> }
	| { type: "suspension_clear" }
	| { type: "suspension_exit_start" }
	| { type: "transaction_view_set"; payload: TransactionViewState }
	| { type: "transaction_view_clear" }
	| { type: "approval_dialog_set"; payload: ApprovalDialogState }
	| { type: "approval_dialog_update"; payload: Partial<ApprovalDialogState> }
	| { type: "approval_dialog_clear" };

const INITIAL_STATE: InventoryWorkflowState = {
	isProcessing: false,
	scanNotification: null,
	successNotification: null,
	errorDialog: {
		message: "",
		isExiting: false,
	},
	suspension: null,
	transactionView: null,
	approvalDialog: null,
};

const inventoryWorkflowReducer = (
	state: InventoryWorkflowState,
	action: InventoryWorkflowAction,
): InventoryWorkflowState => {
	switch (action.type) {
		case "processing_start":
			return { ...state, isProcessing: true };
		case "processing_end":
			return { ...state, isProcessing: false };
		case "scan_notification_set":
			return {
				...state,
				scanNotification: {
					userName: action.payload.userName,
					isExiting: false,
				},
			};
		case "scan_notification_exit_start":
			return {
				...state,
				scanNotification: state.scanNotification
					? { ...state.scanNotification, isExiting: true }
					: null,
			};
		case "scan_notification_clear":
			return { ...state, scanNotification: null };
		case "success_notification_set":
			return {
				...state,
				successNotification: {
					message: action.payload.message,
					isExiting: false,
				},
			};
		case "success_notification_exit_start":
			return {
				...state,
				successNotification: state.successNotification
					? { ...state.successNotification, isExiting: true }
					: null,
			};
		case "success_notification_clear":
			return { ...state, successNotification: null };
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
		case "suspension_set":
			return {
				...state,
				suspension: {
					...action.payload,
					isExiting: false,
				},
			};
		case "suspension_exit_start":
			return {
				...state,
				suspension: state.suspension
					? { ...state.suspension, isExiting: true }
					: null,
			};
		case "suspension_clear":
			return { ...state, suspension: null };
		case "transaction_view_set":
			return { ...state, transactionView: action.payload };
		case "transaction_view_clear":
			return { ...state, transactionView: null };
		case "approval_dialog_set":
			return { ...state, approvalDialog: action.payload };
		case "approval_dialog_update":
			return {
				...state,
				approvalDialog: state.approvalDialog
					? { ...state.approvalDialog, ...action.payload }
					: null,
			};
		case "approval_dialog_clear":
			return { ...state, approvalDialog: null };
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

export function useInventoryWorkflow() {
	const log = useMemo(() => getLogger("app"), []);
	const [state, dispatch] = useReducer(inventoryWorkflowReducer, INITIAL_STATE);
	const {
		isProcessing,
		scanNotification,
		successNotification,
		errorDialog,
		suspension,
		transactionView,
		approvalDialog,
	} = state;

	const scanNotificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const scanExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const successNotificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const successExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const errorExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const suspensionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const suspensionExitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const dismissScanNotification = useCallback(() => {
		clearTimer(scanNotificationTimeoutRef);
		clearTimer(scanExitTimeoutRef);
		dispatch({ type: "scan_notification_clear" });
	}, []);

	const scheduleScanHide = useCallback(() => {
		clearTimer(scanNotificationTimeoutRef);
		scanNotificationTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "scan_notification_exit_start" });
			scanExitTimeoutRef.current = setTimeout(() => {
				dispatch({ type: "scan_notification_clear" });
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, []);

	const showSuccess = useCallback((message: string) => {
		clearTimer(successNotificationTimeoutRef);
		clearTimer(successExitTimeoutRef);
		dispatch({ type: "success_notification_set", payload: { message } });
		successNotificationTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "success_notification_exit_start" });
			successExitTimeoutRef.current = setTimeout(() => {
				dispatch({ type: "success_notification_clear" });
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS * 2); // Show success longer
	}, []);

	const scheduleErrorHide = useCallback(() => {
		errorTimeoutRef.current = setTimeout(() => {
			dispatch({ type: "error_exit_start" });
			errorExitTimeoutRef.current = setTimeout(() => {
				dispatch({ type: "error_clear" });
			}, FADE_OUT_DURATION_MS);
		}, NOTIFICATION_DISPLAY_DURATION_MS);
	}, []);

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
		[errorDialog.message, scheduleErrorHide],
	);

	const handleApprovalScan = useCallback(
		async (cardNumber: string) => {
			if (!approvalDialog?.pendingTransaction) return;

			dispatch({
				type: "approval_dialog_update",
				payload: { isProcessing: true },
			});

			try {
				log.info(
					formatLog("Approval scan received", {
						cardId: cardNumber.slice(-6),
						transactionType: approvalDialog.pendingTransaction.type,
						restrictedItemCount: approvalDialog.restrictedItems.length,
					}),
				);

				// Verify the approver has permission
				const result = await trpc.inventory.verifyApprover.mutate({
					cardNumber,
					itemIds: approvalDialog.restrictedItems.map((item) => item.id),
				});

				if (result.status === "unauthorized") {
					// Build error message from unauthorized items
					const itemNames = result.unauthorizedItems.map((item) => item.name).join(", ");
					const errorMessage = `You do not have permission to approve: ${itemNames}`;
					dispatch({
						type: "approval_dialog_update",
						payload: {
							isProcessing: false,
							error: errorMessage,
						},
					});
					return;
				}

				// Approver verified, complete the transaction
				const { type, items, userId } = approvalDialog.pendingTransaction;

				if (type === "checkout") {
					await trpc.inventory.transactions.checkOut.mutate({
						userId,
						items,
					});
				} else {
					await trpc.inventory.transactions.checkIn.mutate({
						userId,
						items,
					});
				}

				dispatch({ type: "approval_dialog_clear" });
				dispatch({ type: "transaction_view_clear" });
				showSuccess(
					type === "checkout"
						? "Items checked out successfully!"
						: "Items returned successfully!",
				);
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : "Approval verification failed";
				log.error(formatLog("Approval scan failed", { error: message }));
				dispatch({
					type: "approval_dialog_update",
					payload: { isProcessing: false, error: message },
				});
			}
		},
		[approvalDialog, log, showSuccess],
	);

	const handleApprovalCancel = useCallback(() => {
		dispatch({ type: "approval_dialog_clear" });
		log.info(formatLog("Approval cancelled"));
	}, [log]);

	const handleScan = useCallback(
		async (cardNumber: string) => {
			// If approval dialog is active, route to approval scan
			if (approvalDialog) {
				await handleApprovalScan(cardNumber);
				return;
			}

			dismissScanNotification();
			dispatch({ type: "processing_start" });

			try {
				log.info(
					formatLog("Card scan requested", {
						cardId: cardNumber.slice(-6),
					}),
				);

				// Verify user and check for suspensions/agreements
				const result = await trpc.inventory.scanUser.mutate({
					cardNumber,
				});

				// Check if user is suspended
				if (result.status === "suspended" && result.suspension) {
					dispatch({ type: "processing_end" });
					clearTimer(suspensionTimeoutRef);
					clearTimer(suspensionExitTimeoutRef);
					dispatch({
						type: "suspension_set",
						payload: {
							userName: result.user.name,
							endDate: result.suspension.endDate,
							externalNotes: result.suspension.externalNotes,
						},
					});
					suspensionTimeoutRef.current = setTimeout(() => {
						dispatch({ type: "suspension_exit_start" });
						suspensionExitTimeoutRef.current = setTimeout(() => {
							dispatch({ type: "suspension_clear" });
						}, FADE_OUT_DURATION_MS);
					}, 5000);
					return;
				}

				// User verified, show success notification and then transaction view
				dispatch({ type: "processing_end" });
				dispatch({
					type: "scan_notification_set",
					payload: { userName: result.user.name },
				});

				// Check if user has any items checked out (net negative balance)
				const balanceResult =
					await trpc.inventory.transactions.checkUserBalance.query({
						userId: result.user.id,
					});

				// After notification, hide it and show transaction view
				scheduleScanHide();
				setTimeout(() => {
					dispatch({
						type: "transaction_view_set",
						payload: {
							userName: result.user.name,
							cardNumber,
							canReturn: balanceResult.hasCheckedOutItems,
							userId: result.user.id,
						},
					});
				}, NOTIFICATION_DISPLAY_DURATION_MS + FADE_OUT_DURATION_MS);
			} catch (error: unknown) {
				dispatch({ type: "processing_end" });
				const message =
					error instanceof Error ? error.message : "Failed to verify card";
				log.error(formatLog("Card scan failed", { error: message }));
				showError(message);
			}
		},
		[approvalDialog, dismissScanNotification, handleApprovalScan, log, scheduleScanHide, showError],
	);

	const handleCheckout = useCallback(
		async (items: { sku: string; quantity: number }[]) => {
			if (!transactionView) return;

			dispatch({ type: "processing_start" });
			try {
				log.info(
					formatLog("Checkout initiated", {
						cardId: transactionView.cardNumber.slice(-6),
						itemCount: items.length,
						totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
					}),
				);

				// Resolve SKUs to item IDs and get approval requirements
				const resolvedItems = await Promise.all(
					items.map(async (it) => {
						const item = await trpc.inventory.items.getBySku.query({
							sku: it.sku,
						});
						if (!item?.id) throw new Error(`Item not found: ${it.sku}`);
						return {
							itemId: item.id,
							quantity: it.quantity,
							name: item.name,
							sku: item.sku ?? it.sku,
							approvalRoles: item.approvalRoles ?? [],
						};
					}),
				);

				// Check if any items require approval
				const restrictedItems = resolvedItems.filter(
					(item) => item.approvalRoles.length > 0,
				);

				if (restrictedItems.length > 0) {
					// Show approval dialog
					dispatch({
						type: "approval_dialog_set",
						payload: {
							restrictedItems: restrictedItems.map((item) => ({
								id: item.itemId,
								name: item.name,
								sku: item.sku,
								quantity: item.quantity,
								approvalRoles: item.approvalRoles,
							})),
							pendingTransaction: {
								type: "checkout",
								items: resolvedItems.map((item) => ({
									itemId: item.itemId,
									quantity: item.quantity,
								})),
								userId: transactionView.userId,
							},
							isProcessing: false,
						},
					});
					dispatch({ type: "processing_end" });
					return;
				}

				// No approval needed, proceed with checkout
				await trpc.inventory.transactions.checkOut.mutate({
					userId: transactionView.userId,
					items: resolvedItems.map((item) => ({
						itemId: item.itemId,
						quantity: item.quantity,
					})),
				});

				dispatch({ type: "transaction_view_clear" });
				showSuccess("Items checked out successfully!");
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : "Failed to checkout items";
				log.error(formatLog("Checkout failed", { error: message }));
				showError(message);
			} finally {
				dispatch({ type: "processing_end" });
			}
		},
		[transactionView, log, showError, showSuccess],
	);

	const handleReturn = useCallback(
		async (items: { sku: string; quantity: number }[]) => {
			if (!transactionView) return;

			dispatch({ type: "processing_start" });
			try {
				log.info(
					formatLog("Return initiated", {
						cardId: transactionView.cardNumber.slice(-6),
						itemCount: items.length,
						totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
					}),
				);

				// Resolve SKUs to item IDs and get approval requirements
				const resolvedItems = await Promise.all(
					items.map(async (it) => {
						const item = await trpc.inventory.items.getBySku.query({
							sku: it.sku,
						});
						if (!item?.id) throw new Error(`Item not found: ${it.sku}`);
						return {
							itemId: item.id,
							quantity: it.quantity,
							name: item.name,
							sku: item.sku ?? it.sku,
							approvalRoles: item.approvalRoles ?? [],
						};
					}),
				);

				// Check if any items require approval
				const restrictedItems = resolvedItems.filter(
					(item) => item.approvalRoles.length > 0,
				);

				if (restrictedItems.length > 0) {
					// Show approval dialog
					dispatch({
						type: "approval_dialog_set",
						payload: {
							restrictedItems: restrictedItems.map((item) => ({
								id: item.itemId,
								name: item.name,
								sku: item.sku,
								quantity: item.quantity,
								approvalRoles: item.approvalRoles,
							})),
							pendingTransaction: {
								type: "return",
								items: resolvedItems.map((item) => ({
									itemId: item.itemId,
									quantity: item.quantity,
								})),
								userId: transactionView.userId,
							},
							isProcessing: false,
						},
					});
					dispatch({ type: "processing_end" });
					return;
				}

				// No approval needed, proceed with return
				await trpc.inventory.transactions.checkIn.mutate({
					userId: transactionView.userId,
					items: resolvedItems.map((item) => ({
						itemId: item.itemId,
						quantity: item.quantity,
					})),
				});

				dispatch({ type: "transaction_view_clear" });
				showSuccess("Items returned successfully!");
			} catch (error: unknown) {
				const message =
					error instanceof Error ? error.message : "Failed to return items";
				log.error(formatLog("Return failed", { error: message }));
				showError(message);
			} finally {
				dispatch({ type: "processing_end" });
			}
		},
		[transactionView, log, showError, showSuccess],
	);

	const handleTransactionCancel = useCallback(() => {
		dispatch({ type: "transaction_view_clear" });
	}, []);

	useEffect(() => {
		return () => {
			clearTimer(scanNotificationTimeoutRef);
			clearTimer(scanExitTimeoutRef);
			clearTimer(successNotificationTimeoutRef);
			clearTimer(successExitTimeoutRef);
			clearTimer(errorTimeoutRef);
			clearTimer(errorExitTimeoutRef);
			clearTimer(suspensionTimeoutRef);
			clearTimer(suspensionExitTimeoutRef);
		};
	}, []);

	return {
		isProcessing,
		scanNotification,
		successNotification,
		errorDialog,
		suspension,
		transactionView,
		approvalDialog,
		handleScan,
		handleCheckout,
		handleReturn,
		handleApprovalScan,
		handleApprovalCancel,
		handleTransactionCancel,
		showError,
		dismissScanNotification,
	};
}
