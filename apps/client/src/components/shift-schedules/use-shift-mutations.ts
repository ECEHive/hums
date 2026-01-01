import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useShiftMutations(periodId: number) {
	const queryClient = useQueryClient();

	const registerMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.register.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully registered!");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to register");
		},
	});

	const unregisterMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.unregister.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully unregistered");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to unregister");
		},
	});

	return { registerMutation, unregisterMutation };
}
