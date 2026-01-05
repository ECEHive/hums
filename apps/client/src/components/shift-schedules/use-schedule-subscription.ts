import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import type { ConnectionState } from "./connection-status";
import {
	applyScheduleDelta,
	type SchedulesData,
	type ShiftScheduleUpdateEvent,
} from "./schedule-delta-utils";

/**
 * Query key for the schedules registration data
 */
export const getSchedulesQueryKey = (periodId: number) => [
	"schedulesForRegistration",
	periodId,
];

interface UseScheduleSubscriptionOptions {
	/**
	 * Period ID to subscribe to updates for
	 */
	periodId: number | null;
	/**
	 * Whether the subscription should be active
	 */
	enabled?: boolean;
}

interface UseScheduleSubscriptionResult {
	/**
	 * Current connection state
	 */
	connectionState: ConnectionState;
	/**
	 * Manually trigger a reconnection attempt
	 */
	reconnect: () => void;
}

/**
 * Hook that subscribes to real-time shift schedule updates and applies deltas to the cache.
 *
 * Instead of invalidating the query and refetching all data on each update,
 * this hook applies incremental changes (deltas) directly to the cached data.
 *
 * Benefits:
 * - Reduces server load by avoiding full refetches
 * - Faster UI updates (no network round-trip for data already in the event)
 * - Lower bandwidth usage
 *
 * The delta includes:
 * - Updated users list for the changed shift
 * - New available slots count
 *
 * Computed fields (canRegister, canUnregister, hasTimeOverlap, meetsBalancingRequirement, etc.)
 * are recalculated client-side based on the new state.
 *
 * Returns connection state and a reconnect function for UI feedback.
 */
export function useScheduleSubscription({
	periodId,
	enabled = true,
}: UseScheduleSubscriptionOptions): UseScheduleSubscriptionResult {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const currentUserId = user?.id;

	// Track WebSocket connection state
	const [wsState, setWsState] = useState<ConnectionState>("connecting");
	// Track browser online/offline state
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const [reconnectTrigger, setReconnectTrigger] = useState(0);

	// Track if we've had an initial successful connection (for toast notifications)
	const hasHadSuccessfulConnectionRef = useRef(false);
	// Track the previous effective connection state for detecting transitions
	const prevConnectionStateRef = useRef<ConnectionState>("connecting");

	// Keep refs to avoid recreating the subscription when these change
	const currentUserIdRef = useRef(currentUserId);
	currentUserIdRef.current = currentUserId;

	// The effective connection state considers both WebSocket and network status
	const connectionState: ConnectionState = !isOnline ? "disconnected" : wsState;

	// Handle online/offline events
	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			// Auto-reconnect when coming back online
			// Note: We don't invalidate queries here to avoid triggering refetches
			// that could cause UI disruptions. The subscription will receive any
			// missed updates via the server's event stream.
			if (periodId && enabled) {
				setReconnectTrigger((prev) => prev + 1);
			}
		};

		const handleOffline = () => {
			setIsOnline(false);
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [periodId, enabled]);

	// Show toast notifications on connection state changes (but not on initial connection)
	useEffect(() => {
		const prevState = prevConnectionStateRef.current;
		const currentState = connectionState;

		// Update the ref for next comparison
		prevConnectionStateRef.current = currentState;

		// Track successful connections
		if (currentState === "connected") {
			const hadPreviousConnection = hasHadSuccessfulConnectionRef.current;
			hasHadSuccessfulConnectionRef.current = true;

			// Only show reconnected toast if we had a previous connection and were disconnected
			if (hadPreviousConnection && prevState === "disconnected") {
				toast.success("Connection restored", {
					description: "You're now receiving live updates again.",
					duration: 3000,
				});
			}
		}

		// Show disconnected toast only if we had a previous successful connection
		if (
			currentState === "disconnected" &&
			prevState === "connected" &&
			hasHadSuccessfulConnectionRef.current
		) {
			toast.error("Connection lost", {
				description: "Live updates are paused. Check your network connection.",
				duration: 5000,
			});
		}
	}, [connectionState]);

	const reconnect = useCallback(() => {
		setWsState("connecting");
		setReconnectTrigger((prev) => prev + 1);
		// Also invalidate to get fresh data on reconnect
		if (periodId) {
			queryClient.invalidateQueries({
				queryKey: getSchedulesQueryKey(periodId),
			});
		}
	}, [periodId, queryClient]);

	useEffect(() => {
		if (!periodId || !enabled) {
			setWsState("disconnected");
			return;
		}

		setWsState("connecting");
		const queryKey = getSchedulesQueryKey(periodId);

		// Track if we've received any data (indicates successful connection)
		let hasConnected = false;

		const unsubscribe = trpc.shiftSchedules.onScheduleUpdate.subscribe(
			{ periodId },
			{
				onStarted: () => {
					// Connection established
					hasConnected = true;
					setWsState("connected");
				},
				onData: (data) => {
					// If we get data, we're definitely connected
					if (!hasConnected) {
						hasConnected = true;
						setWsState("connected");
					}

					// Type assertion for the event data from tRPC tracked()
					const rawEvent = data as { id: string; data: unknown };
					const event = rawEvent.data as ShiftScheduleUpdateEvent;

					// Get current user ID from ref
					const userId = currentUserIdRef.current;

					if (!userId) {
						// User not authenticated, can't apply delta properly
						// Fall back to invalidation
						queryClient.invalidateQueries({ queryKey });
						return;
					}

					// Cancel any in-progress queries to prevent race conditions
					// This ensures the delta update won't be overwritten by stale data
					// Using void to fire-and-forget the async operation
					void queryClient.cancelQueries({ queryKey }).then(() => {
						// Apply delta directly to the cache after cancellation
						queryClient.setQueryData<SchedulesData | null>(
							queryKey,
							(currentData) => {
								if (!currentData) {
									// No cached data, nothing to update
									// This shouldn't normally happen if the query was fetched
									return currentData;
								}

								return applyScheduleDelta(currentData, event, userId);
							},
						);
					});
				},
				onError: (err) => {
					console.error("Schedule subscription error:", err);
					setWsState("disconnected");
					// Note: We don't invalidate queries on error to avoid triggering
					// refetches that could disrupt the UI (like closing open dialogs).
					// The user can manually reconnect if needed, which will refresh data.
				},
				onComplete: () => {
					// Subscription ended (server closed it or clean disconnect)
					setWsState("disconnected");
				},
			},
		);

		return () => {
			unsubscribe.unsubscribe();
			setWsState("disconnected");
		};
	}, [periodId, enabled, queryClient, reconnectTrigger]);

	return { connectionState, reconnect };
}
