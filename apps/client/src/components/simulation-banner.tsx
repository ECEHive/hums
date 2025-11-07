import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Enhanced simulation banner with tracking
 */
export function SimulationBanner() {
	const { user, setToken } = useAuth();
	const queryClient = useQueryClient();

	// Check if we're in simulation mode by looking at localStorage
	const isSimulating =
		typeof window !== "undefined" &&
		localStorage.getItem("simulation_mode") === "true";

	const handleEndSimulation = () => {
		if (typeof window === "undefined") return;

		// Restore original token if it exists
		const originalToken = localStorage.getItem("original_token");

		localStorage.removeItem("simulation_mode");
		localStorage.removeItem("original_token");

		if (originalToken) {
			setToken(originalToken);
			toast.success("Simulation ended, returning to your account");
		} else {
			setToken(null);
			toast.info("Please log in again");
		}

		queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
	};

	if (!isSimulating || !user) {
		return null;
	}

	return (
		<Alert className="rounded-none border-x-0 border-t-0 border-b border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
			<AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
			<AlertTitle className="text-yellow-800 dark:text-yellow-400">
				Simulation Mode Active
			</AlertTitle>
			<AlertDescription className="flex items-center justify-between text-yellow-700 dark:text-yellow-500">
				<span>
					You are currently simulating user:{" "}
					<strong>{user.name || user.email}</strong>
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={handleEndSimulation}
					className="ml-4 border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900"
				>
					<X className="h-4 w-4 mr-2" />
					End Simulation
				</Button>
			</AlertDescription>
		</Alert>
	);
}
