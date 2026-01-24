import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
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
import { checkPermissions } from "@/lib/permissions";
import type { ItemRow } from "./types";

interface DeleteItemDialogProps {
	item: ItemRow;
}

export function DeleteDialog({ item }: DeleteItemDialogProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async () => trpc.inventory.items.delete.mutate({ id: item.id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
			setOpen(false);
			setError(null);
		},
		onError: (err) => {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		},
	});

	const user = useAuth().user;
	const canDelete = user && checkPermissions(user, ["inventory.items.delete"]);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={`Delete ${item.name}`}
					hidden={!canDelete}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete &ldquo;{item.name}&rdquo;?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone.
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
