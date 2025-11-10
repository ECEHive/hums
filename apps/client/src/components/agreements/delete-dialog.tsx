import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { useAuth } from "@/auth/AuthProvider";
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
import { checkPermissions } from "@/lib/permissions";
import { Spinner } from "../ui/spinner";

type DeleteDialogProps = {
	agreementId: number;
	agreementTitle: string;
};

export function DeleteDialog({
	agreementId,
	agreementTitle,
}: DeleteDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const deleteAgreementMutation = useMutation({
		mutationFn: ({ id }: { id: number }) => {
			return trpc.agreements.delete.mutate({ id });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agreements"] });
			setOpen(false);
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : String(error);
			setServerError(message);
		},
	});

	const user = useAuth().user;
	const canDelete = user && checkPermissions(user, ["agreements.delete"]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm" disabled={!canDelete}>
					<Trash2 className="h-4 w-4 text-destructive" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete Agreement</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete "{agreementTitle}"? This action
						cannot be undone.
					</DialogDescription>
				</DialogHeader>
				{serverError && (
					<p className="text-sm text-destructive">{serverError}</p>
				)}
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={() => deleteAgreementMutation.mutate({ id: agreementId })}
						disabled={deleteAgreementMutation.isPending}
					>
						{deleteAgreementMutation.isPending ? <Spinner /> : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
