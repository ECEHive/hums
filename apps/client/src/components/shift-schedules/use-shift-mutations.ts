import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import {
	applyOptimisticBulkRegister,
	applyOptimisticRegister,
	applyOptimisticUnregister,
	type SchedulesData,
	setUserRegistration,
} from "./schedule-delta-utils";
import { getSchedulesQueryKey } from "./use-schedule-subscription";

/**
 * Hook providing mutations for shift registration with optimistic updates.
 *
 * Instead of invalidating and refetching on success, this hook:
 * 1. Applies optimistic updates immediately when mutation starts
 * 2. Undoes them on error
 * 3. Does NOT invalidate on success - the subscription will receive the delta from the server
 *
 * This creates a smooth UX where:
 * - User sees immediate feedback (optimistic update)
 * - Server confirms the change via subscription
 * - Other users see the change via their subscriptions
 * - No unnecessary refetches occur
 */
export function useShiftMutations(periodId: number) {
	const queryClient = useQueryClient();
	const { user } = useAuth();

	const queryKey = getSchedulesQueryKey(periodId);
	const currentUser = user
		? { id: user.id, name: user.name ?? "Unknown" }
		: undefined;

	const applyOptimistic = (
		update: (
			data: SchedulesData,
			user: { id: number; name: string },
		) => SchedulesData,
	) => {
		if (!currentUser) return;
		queryClient.setQueryData<SchedulesData>(queryKey, (data) =>
			data ? update(data, currentUser) : data,
		);
	};

	// Restoring a snapshot would also throw away every live update received since.
	// A rejection (full, balancing, outside the window, ...) means nothing changed on
	// the server, so only this user's change is undone. A timeout, network error or
	// 5xx may have committed, so the list is reloaded instead.
	const undoOptimistic = (
		error: unknown,
		shiftScheduleIds: number[],
		registeredBefore: boolean,
	) => {
		const status = (error as { data?: { httpStatus?: number } } | null)?.data
			?.httpStatus;
		const rejected =
			status !== undefined &&
			status >= 400 &&
			status < 500 &&
			status !== 408 &&
			status !== 499;
		if (rejected) {
			applyOptimistic((data, user) =>
				setUserRegistration(data, shiftScheduleIds, user, registeredBefore),
			);
		} else {
			queryClient.invalidateQueries({ queryKey });
		}
	};

	const registerMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.register.mutate({ shiftScheduleId });
		},
		onMutate: (shiftScheduleId) => {
			applyOptimistic((data, user) =>
				applyOptimisticRegister(data, shiftScheduleId, user),
			);
		},
		onError: (error, shiftScheduleId) => {
			undoOptimistic(error, [shiftScheduleId], false);
			toast.error(error.message || "Failed to register");
		},
		onSuccess: () => {
			// Don't invalidate - the subscription will apply the server delta
			toast.success("Successfully registered!");
		},
	});

	const unregisterMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.unregister.mutate({ shiftScheduleId });
		},
		onMutate: (shiftScheduleId) => {
			applyOptimistic((data, user) =>
				applyOptimisticUnregister(data, shiftScheduleId, user),
			);
		},
		onError: (error, shiftScheduleId) => {
			undoOptimistic(error, [shiftScheduleId], true);
			toast.error(error.message || "Failed to unregister");
		},
		onSuccess: () => {
			// Don't invalidate - the subscription will apply the server delta
			toast.success("Successfully unregistered");
		},
	});

	const bulkRegisterMutation = useMutation({
		mutationFn: async (shiftScheduleIds: number[]) => {
			return trpc.shiftSchedules.bulkRegister.mutate({ shiftScheduleIds });
		},
		onMutate: (shiftScheduleIds) => {
			applyOptimistic((data, user) =>
				applyOptimisticBulkRegister(data, shiftScheduleIds, user),
			);
		},
		onError: (error, shiftScheduleIds) => {
			// Bulk registration is all or nothing
			undoOptimistic(error, shiftScheduleIds, false);
			toast.error(error.message || "Failed to register for shifts");
		},
		onSuccess: (_data, shiftScheduleIds) => {
			toast.success(
				`Successfully registered for ${shiftScheduleIds.length} shift${shiftScheduleIds.length !== 1 ? "s" : ""}!`,
			);
		},
	});

	return { registerMutation, unregisterMutation, bulkRegisterMutation };
}
