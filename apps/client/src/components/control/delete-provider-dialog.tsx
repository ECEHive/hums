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

type ControlProvider = {
	id: number;
	name: string;
	_count?: {
		controlPoints: number;
	};
};

type DeleteProviderDialogProps = {
	provider: ControlProvider;
	onDelete?: () => void;
};

export function DeleteProviderDialog({
	provider,
	onDelete,
}: DeleteProviderDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasControlPoints = (provider._count?.controlPoints ?? 0) > 0;

	const mutation = useMutation({
		mutationFn: async () =>
			trpc.control.providers.delete.mutate({ id: provider.id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "providers"] });
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
					aria-label={`Delete provider ${provider.name}`}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete &ldquo;{provider.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{hasControlPoints ? (
							<>
								This provider cannot be deleted because it has{" "}
								{provider._count?.controlPoints} control point
								{provider._count?.controlPoints === 1 ? "" : "s"} associated
								with it. Please delete or reassign those control points first.
							</>
						) : (
							<>
								This action cannot be undone. The provider will be permanently
								removed.
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <p className="text-sm text-destructive">{error}</p>}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					{!hasControlPoints && (
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => mutation.mutate()}
							disabled={mutation.isPending}
						>
							{mutation.isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
