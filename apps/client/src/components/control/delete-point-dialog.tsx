import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
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

type ControlPoint = {
	id: string;
	name: string;
};

type DeleteControlPointDialogProps = {
	point: ControlPoint;
	onDelete?: () => void;
};

export function DeleteControlPointDialog({
	point,
	onDelete,
}: DeleteControlPointDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async () => trpc.control.points.delete.mutate({ id: point.id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "points"] });
			setOpen(false);
			setError(null);
			onDelete?.();
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
					aria-label={`Delete control point ${point.name}`}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete &ldquo;{point.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. All control logs for this point will
						also be deleted.
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
