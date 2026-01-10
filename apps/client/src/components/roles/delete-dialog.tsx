import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
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
	roleId: number;
	roleName: string;
};

export function DeleteDialog({
	roleId,
	roleName,
}: DeleteDialogProps): JSX.Element {
	const queryClient = useQueryClient();

	const currentUser = useAuth().user;
	const canDelete =
		currentUser && checkPermissions(currentUser, ["roles.delete"]);

	const deleteRole = async (roleId: number) => {
		try {
			await trpc.roles.delete.mutate({ id: roleId });

			// Invalidate the roles query to refresh data
			queryClient.invalidateQueries({ queryKey: ["roles"] });
		} catch (err) {
			console.error("Failed to delete role:", err);
		}
	};

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						disabled={!canDelete}
						aria-label={`Delete role ${roleName}`}
					>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							Are you sure you want to delete {roleName}?
						</DialogTitle>
						<DialogDescription>This action cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								onClick={() => deleteRole(roleId)}
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
