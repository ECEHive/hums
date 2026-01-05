import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
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

	const [connectionState, setConnectionState] =
		useState<ConnectionState>("connecting");
	const [reconnectTrigger, setReconnectTrigger] = useState(0);

	// Keep refs to avoid recreating the subscription when these change
	const currentUserIdRef = useRef(currentUserId);
	currentUserIdRef.current = currentUserId;

	const reconnect = useCallback(() => {
		setConnectionState("connecting");
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
			setConnectionState("disconnected");
			return;
		}

		setConnectionState("connecting");
		const queryKey = getSchedulesQueryKey(periodId);

		// Track if we've received any data (indicates successful connection)
		let hasConnected = false;

		const unsubscribe = trpc.shiftSchedules.onScheduleUpdate.subscribe(
			{ periodId },
			{
				onStarted: () => {
					// Connection established
					hasConnected = true;
					setConnectionState("connected");
				},
				onData: (data) => {
					// If we get data, we're definitely connected
					if (!hasConnected) {
						hasConnected = true;
						setConnectionState("connected");
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
					setConnectionState("disconnected");
					// On error, fall back to invalidation to ensure data consistency
					queryClient.invalidateQueries({ queryKey });
				},
				onComplete: () => {
					// Subscription ended (server closed it or clean disconnect)
					setConnectionState("disconnected");
				},
			},
		);

		return () => {
			unsubscribe.unsubscribe();
			setConnectionState("disconnected");
		};
	}, [periodId, enabled, queryClient, reconnectTrigger]);

	return { connectionState, reconnect };
}
