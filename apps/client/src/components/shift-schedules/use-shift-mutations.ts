import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import {
	applyOptimisticBulkRegister,
	applyOptimisticRegister,
	applyOptimisticUnregister,
	type SchedulesData,
} from "./schedule-delta-utils";
import { getSchedulesQueryKey } from "./use-schedule-subscription";

/**
 * Hook providing mutations for shift registration with optimistic updates.
 *
 * Instead of invalidating and refetching on success, this hook:
 * 1. Applies optimistic updates immediately when mutation starts
 * 2. Rolls back on error
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

	const registerMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.register.mutate({ shiftScheduleId });
		},
		onMutate: async (shiftScheduleId) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey });

			// Snapshot the previous value
			const previousData = queryClient.getQueryData<SchedulesData>(queryKey);

			// Optimistically update to the new value
			if (previousData && user) {
				const optimisticData = applyOptimisticRegister(
					previousData,
					shiftScheduleId,
					{ id: user.id, name: user.name ?? "Unknown" },
				);
				queryClient.setQueryData(queryKey, optimisticData);
			}

			// Return context with the snapshot
			return { previousData };
		},
		onError: (error, _shiftScheduleId, context) => {
			// Roll back to the previous value on error
			if (context?.previousData) {
				queryClient.setQueryData(queryKey, context.previousData);
			}
			toast.error(error.message || "Failed to register");
		},
		onSuccess: () => {
			// Don't invalidate - the subscription will apply the server delta
			// This prevents a redundant refetch
			toast.success("Successfully registered!");
		},
	});

	const unregisterMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.unregister.mutate({ shiftScheduleId });
		},
		onMutate: async (shiftScheduleId) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey });

			// Snapshot the previous value
			const previousData = queryClient.getQueryData<SchedulesData>(queryKey);

			// Optimistically update to the new value
			if (previousData && user) {
				const optimisticData = applyOptimisticUnregister(
					previousData,
					shiftScheduleId,
					{ id: user.id, name: user.name ?? "Unknown" },
				);
				queryClient.setQueryData(queryKey, optimisticData);
			}

			// Return context with the snapshot
			return { previousData };
		},
		onError: (error, _shiftScheduleId, context) => {
			// Roll back to the previous value on error
			if (context?.previousData) {
				queryClient.setQueryData(queryKey, context.previousData);
			}
			toast.error(error.message || "Failed to unregister");
		},
		onSuccess: () => {
			// Don't invalidate - the subscription will apply the server delta
			// This prevents a redundant refetch
			toast.success("Successfully unregistered");
		},
	});

	const bulkRegisterMutation = useMutation({
		mutationFn: async (shiftScheduleIds: number[]) => {
			return trpc.shiftSchedules.bulkRegister.mutate({ shiftScheduleIds });
		},
		onMutate: async (shiftScheduleIds) => {
			await queryClient.cancelQueries({ queryKey });

			const previousData = queryClient.getQueryData<SchedulesData>(queryKey);

			if (previousData && user) {
				const optimisticData = applyOptimisticBulkRegister(
					previousData,
					shiftScheduleIds,
					{ id: user.id, name: user.name ?? "Unknown" },
				);
				queryClient.setQueryData(queryKey, optimisticData);
			}

			return { previousData };
		},
		onError: (error, _shiftScheduleIds, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKey, context.previousData);
			}
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
