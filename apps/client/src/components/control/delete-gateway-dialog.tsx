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

type ControlGateway = {
	id: number;
	name: string;
};

type DeleteGatewayDialogProps = {
	gateway: ControlGateway;
	onDelete?: () => void;
};

export function DeleteGatewayDialog({
	gateway,
	onDelete,
}: DeleteGatewayDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: async () =>
			trpc.control.gateways.delete.mutate({ id: gateway.id }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["control", "gateways"],
			});
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
					aria-label={`Delete gateway ${gateway.name}`}
				>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete &ldquo;{gateway.name}&rdquo;?
					</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete this gateway and all its configured
						actions. External systems using this gateway&apos;s access token
						will no longer be able to control equipment.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error && <p className="text-sm text-destructive px-6">{error}</p>}
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault();
							mutation.mutate();
						}}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{mutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
