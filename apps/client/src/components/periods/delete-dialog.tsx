import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
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
	const router = useRouter();
	const [serverError, setServerError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async (id: number) => trpc.periods.delete.mutate({ id }),
		onSuccess: () => {
			// Remove cached period list and the deleted period to avoid stale redirect
			queryClient.removeQueries({ queryKey: ["periods"], exact: false });
			queryClient.removeQueries({
				queryKey: ["period", Number(periodId)],
				exact: true,
			});
			// Navigate after cache is cleared so Periods won't redirect to the deleted id
			void router.navigate({ to: "/app/periods" });
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
