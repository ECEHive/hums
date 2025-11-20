import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HatGlassesIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";

interface ImpersonateUserButtonProps {
	userId: number;
	userName: string;
	disabled?: boolean;
}

export function ImpersonateUserButton({
	userId,
	userName,
	disabled = false,
}: ImpersonateUserButtonProps) {
	const { setToken, token } = useAuth();
	const queryClient = useQueryClient();

	const impersonateMutation = useMutation({
		mutationFn: async () => {
			return await trpc.auth.impersonate.mutate({ userId });
		},
		onSuccess: (data) => {
			// Store the original token before switching
			if (typeof window !== "undefined" && token) {
				localStorage.setItem("original_token", token);
				localStorage.setItem("impersonation_mode", "true");
			}

			// Switch to the new token
			setToken(data.token);

			// Invalidate queries to refresh with new user context
			queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

			toast.success(`You are now impersonating ${userName}`);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to impersonate user");
		},
	});

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => impersonateMutation.mutate()}
			disabled={disabled || impersonateMutation.isPending}
			aria-label={`Impersonate user ${userName}`}
			title={`Impersonate user ${userName}`}
		>
			<HatGlassesIcon className="h-4 w-4" />
		</Button>
	);
}
