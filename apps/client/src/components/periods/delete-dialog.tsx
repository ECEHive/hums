import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
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

	const currentUser = useAuth().user;
	const canDelete =
		currentUser && checkPermissions(currentUser, ["periods.delete"]);

	const deletePeriod = async (periodId: number) => {
		try {
			await trpc.periods.delete.mutate({ id: periodId });

			// Remove cached period list and the deleted period to avoid stale redirect
			// Remove any cached "periods" queries (not exact so variants match)
			queryClient.removeQueries({ queryKey: ["periods"], exact: false });
			// Remove the specific period cache
			queryClient.removeQueries({
				queryKey: ["period", Number(periodId)],
				exact: true,
			});
		} catch (err) {
			console.error("Failed to delete period:", err);
		}
	};

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
						<DialogClose asChild>
							<Button
								onClick={async () => {
									await deletePeriod(periodId);
									// navigate after cache is cleared so Periods won't redirect to the deleted id
									void router.navigate({ to: "/app/periods" });
								}}
								variant="destructive"
								disabled={!canDelete}
							>
								Delete
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</form>
		</Dialog>
	);
}
