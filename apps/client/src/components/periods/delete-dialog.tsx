import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// routing handled via window.location in this component to avoid router typing constraints
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { usePeriod } from "@/components/providers/period-provider";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

type DeleteDialogProps = {
	periodId: number;
	periodName: string;
};

export function DeleteDialog({
	periodId,
	periodName,
}: DeleteDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);

	const { setPeriod } = usePeriod();

	const mutation = useMutation({
		mutationFn: async (id: number) => trpc.periods.delete.mutate({ id }),
		onSuccess: async () => {
			// Remove cached period list and the deleted period to avoid stale redirect
			queryClient.removeQueries({ queryKey: ["periods"], exact: false });
			queryClient.removeQueries({
				queryKey: ["period", Number(periodId)],
				exact: true,
			});

			// Fetch the updated list of visible periods to pick the next one (if any)
			try {
				const data = await trpc.periods.listVisible.query({ limit: 100 });
				const remaining = data?.periods ?? [];
				if (remaining.length > 0) {
					// pick the first remaining period as the next selection
					const next = remaining[0];
					try {
						setPeriod(next.id);
					} catch (_) {
						// ignore if context not available
					}
					// Navigate to the details page for the next period
					window.location.href = `/shifts/`;
				} else {
					// No periods remain: clear selection and go to list page
					try {
						setPeriod(null);
					} catch (_) {}
					window.location.href = "/app/shifts/";
				}
			} catch (err) {
				// If fetching periods failed, fallback to navigating to the periods list
				console.error("Failed to fetch periods after delete:", err);
				window.location.href = "/app/shifts/";
			}
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			setServerError(message);
			console.error("Failed to delete period:", err);
		},
	});

	const [isProcessing, setIsProcessing] = useState(false);

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button variant="ghost" size="icon" aria-label="Delete period">
						<Trash2 className="h-4 w-4" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							Are you sure you want to delete {periodName}?
						</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => {
								setServerError(null);
								setIsProcessing(true);
								mutation.mutate(periodId, {
									onSettled: () => setIsProcessing(false),
								});
							}}
							variant="destructive"
							disabled={isProcessing}
						>
							{isProcessing ? "Deleting..." : "Delete"}
						</Button>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
					</DialogFooter>
					{serverError && (
						<p className="text-sm text-destructive px-6">{serverError}</p>
					)}
				</DialogContent>
			</form>
		</Dialog>
	);
}
