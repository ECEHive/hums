import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PeriodExceptionRow } from "./types";

interface DeletePeriodExceptionDialogProps {
	periodException: PeriodExceptionRow;
}

export function DeletePeriodExceptionDialog({
	periodException,
}: DeletePeriodExceptionDialogProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async () =>
			trpc.periodExceptions.delete.mutate({ id: periodException.id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["periodExceptions"] });
			setOpen(false);
			setError(null);
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		},
	});

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Delete period exception ${periodException.name}`}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete &ldquo;{periodException.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. Any shift occurrences within this
						range will be regenerated.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
					>
						{mutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
