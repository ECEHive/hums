import { trpc } from "@ecehive/trpc/client";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import type { ConnectionState } from "./connection-status";
import {
	applyScheduleDeltas,
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

// When each list query last finished a real fetch. Module-level because a network
// blip remounts the whole app (AuthProvider refetches auth.me on reconnect), and
// not dataUpdatedAt, which our own setQueryData writes also move.
const listFetchedAt = new Map<string, number>();

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
			// Reconnecting also reloads the list (see onStarted)
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
	}, []);

	const retryAttemptRef = useRef(0);

	useEffect(() => {
		if (!periodId || !enabled) {
			setWsState("disconnected");
			return;
		}

		setWsState("connecting");
		const queryKey = getSchedulesQueryKey(periodId);
		const queryHash = hashKey(queryKey);

		// Track if we've received any data (indicates successful connection)
		let hasConnected = false;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		const connectingSince = Date.now();
		let startedBefore = false;

		// A list fetch may have been computed before updates that arrive while it's
		// in flight, so those are applied again once it lands. Each update carries the
		// schedule's full user list, so re-applying is safe. Cancelling the fetch
		// instead left first loads empty, since nothing retried it.
		let arrivedDuringFetch: ShiftScheduleUpdateEvent[] = [];

		const applyEvents = (events: ShiftScheduleUpdateEvent[]) => {
			const userId = currentUserIdRef.current;
			if (!userId) {
				queryClient.invalidateQueries({ queryKey });
				return;
			}
			queryClient.setQueryData<SchedulesData | null>(queryKey, (currentData) =>
				currentData
					? applyScheduleDeltas(currentData, events, userId)
					: currentData,
			);
		};

		const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
			if (event.type !== "updated" || event.query.queryHash !== queryHash) {
				return;
			}
			const { action } = event;
			// Kept past a failed fetch, they'd be replayed over newer data later
			if (action.type === "error") {
				arrivedDuringFetch = [];
				return;
			}
			// manual: our own setQueryData calls; only a finished fetch counts
			if (action.type !== "success" || action.manual) return;
			listFetchedAt.set(queryHash, Date.now());
			const events = arrivedDuringFetch;
			arrivedDuringFetch = [];
			if (events.length > 0) applyEvents(events);
		});

		const unsubscribe = trpc.shiftSchedules.onScheduleUpdate.subscribe(
			{ periodId },
			{
				onStarted: () => {
					hasConnected = true;
					setWsState("connected");
					retryAttemptRef.current = 0;
					// The server doesn't replay updates sent before a stream starts, so a list
					// fetched before this stream may be missing some
					const fetchedAt = listFetchedAt.get(queryHash) ?? 0;
					if (startedBefore || (fetchedAt > 0 && fetchedAt < connectingSince)) {
						queryClient.invalidateQueries({ queryKey });
					}
					startedBefore = true;
				},
				onData: ({ events }) => {
					if (!hasConnected) {
						hasConnected = true;
						setWsState("connected");
					}
					if (queryClient.isFetching({ queryKey }) > 0) {
						arrivedDuringFetch.push(...events);
					}
					applyEvents(events);
				},
				onError: (err) => {
					console.error("Schedule subscription error:", err);
					setWsState("disconnected");
					// Auth/access errors arrive after onStarted, which resets the backoff,
					// so retrying them would loop every second
					const status = (err as { data?: { httpStatus?: number } }).data
						?.httpStatus;
					if (status !== undefined && status >= 400 && status < 500) return;
					// e.g. a 502 during a deploy, which the browser won't retry on its own.
					// Jitter keeps every open page from reconnecting at the same moment.
					const attempt = retryAttemptRef.current++;
					const delay =
						Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
					retryTimer = setTimeout(
						() => setReconnectTrigger((prev) => prev + 1),
						delay,
					);
				},
				onComplete: () => {
					// Subscription ended (server closed it or clean disconnect)
					setWsState("disconnected");
				},
			},
		);

		return () => {
			clearTimeout(retryTimer);
			unsubscribeCache();
			unsubscribe.unsubscribe();
			setWsState("disconnected");
		};
	}, [periodId, enabled, queryClient, reconnectTrigger]);

	return { connectionState, reconnect };
}
