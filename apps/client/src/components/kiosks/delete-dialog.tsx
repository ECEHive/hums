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
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

type Kiosk = {
	id: number;
	name: string;
};

type DeleteDialogProps = {
	kiosk: Kiosk;
};

export function DeleteDialog({ kiosk }: DeleteDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: (id: number) => trpc.kiosks.delete.mutate({ id }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["kiosks"] });
			setOpen(false);
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : String(err));
		},
	});

	const handleDelete = () => {
		deleteMutation.mutate(kiosk.id);
	};

	const user = useAuth().user;
	const canDelete = user && checkPermissions(user, ["kiosks.delete"]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" disabled={!canDelete}>
					<Trash2 className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Delete Kiosk</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete "{kiosk.name}"? This action cannot
						be undone.
					</DialogDescription>
				</DialogHeader>
				{error && <div className="text-sm text-destructive">{error}</div>}
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline" disabled={deleteMutation.isPending}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
					>
						{deleteMutation.isPending ? <Spinner /> : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
