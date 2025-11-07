import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";

interface SimulateUserButtonProps {
	userId: number;
	userName: string;
	disabled?: boolean;
}

export function SimulateUserButton({
	userId,
	userName,
	disabled = false,
}: SimulateUserButtonProps) {
	const { setToken, token } = useAuth();
	const queryClient = useQueryClient();

	const simulateMutation = useMutation({
		mutationFn: async () => {
			return await trpc.auth.simulate.mutate({ userId });
		},
		onSuccess: (data) => {
			// Store the original token before switching
			if (typeof window !== "undefined" && token) {
				localStorage.setItem("original_token", token);
				localStorage.setItem("simulation_mode", "true");
			}

			// Switch to the new token
			setToken(data.token);

			// Invalidate queries to refresh with new user context
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

			toast.success(`You are now simulating ${userName}`);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to simulate user");
		},
	});

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => simulateMutation.mutate()}
			disabled={disabled || simulateMutation.isPending}
			aria-label={`Simulate user ${userName}`}
			title={`Simulate user ${userName}`}
		>
			<UserRoundCog className="h-4 w-4" />
		</Button>
	);
}
