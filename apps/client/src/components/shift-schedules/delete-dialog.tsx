import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
	shiftScheduleId: number;
	shiftTypeName: string;
	periodId: number;
};

export function DeleteDialog({
	shiftScheduleId,
	shiftTypeName,
	periodId,
}: DeleteDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async (id: number) => trpc.shiftSchedules.delete.mutate({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftSchedules", { periodId }],
			});
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			setServerError(message);
			console.error("Failed to delete shift schedule:", err);
		},
	});

	const [isProcessing, setIsProcessing] = useState(false);

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Delete shift schedule"
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							Are you sure you want to delete this shift schedule for{" "}
							{shiftTypeName}?
						</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => {
								setServerError(null);
								setIsProcessing(true);
								mutation.mutate(shiftScheduleId, {
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
