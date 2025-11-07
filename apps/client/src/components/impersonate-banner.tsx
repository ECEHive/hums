import { useQueryClient } from "@tanstack/react-query";
import { HatGlassesIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Enhanced impersonation banner with tracking
 */
export function ImpersonationBanner() {
	const { user, setToken } = useAuth();
	const queryClient = useQueryClient();

	// Check if we're in impersonation mode by looking at localStorage
	const isImpersonating =
		typeof window !== "undefined" &&
		localStorage.getItem("impersonation_mode") === "true";

	const handleEndImpersonation = () => {
		if (typeof window === "undefined") return;

		// Restore original token if it exists
		const originalToken = localStorage.getItem("original_token");

		localStorage.removeItem("impersonation_mode");
		localStorage.removeItem("original_token");

		if (originalToken) {
			setToken(originalToken);
			toast.success("Impersonation ended, returning to your account");
		} else {
			setToken(null);
			toast.info("Please log in again");
		}

		queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
	};

	if (!isImpersonating || !user) {
		return null;
	}

	return (
		<Alert className="rounded-none border-x-0 border-t-0 border-b border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
			<HatGlassesIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
			<AlertTitle className="text-yellow-800 dark:text-yellow-400">
				Impersonation Mode Active
			</AlertTitle>
			<AlertDescription className="flex items-center justify-between text-yellow-700 dark:text-yellow-500">
				<span>
					You are currently impersonating user:{" "}
					<strong>{user.name || user.username}</strong>
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={handleEndImpersonation}
					className="ml-4 border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900"
				>
					<X className="h-4 w-4 mr-2" />
					End Impersonation
				</Button>
			</AlertDescription>
		</Alert>
	);
}
