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
	shiftTypeId: number;
	shiftTypeName: string;
	periodId: number;
};

export function DeleteDialog({
	shiftTypeId,
	shiftTypeName,
	periodId,
}: DeleteDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async (id: number) => trpc.shiftTypes.delete.mutate({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftTypes", { periodId }],
			});
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			setServerError(message);
			console.error("Failed to delete shift type:", err);
		},
	});

	const [isProcessing, setIsProcessing] = useState(false);

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button variant="ghost" size="icon" aria-label="Delete shift type">
						<Trash2 className="h-4 w-4" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							Are you sure you want to delete {shiftTypeName}?
						</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() => {
								setServerError(null);
								setIsProcessing(true);
								mutation.mutate(shiftTypeId, {
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
