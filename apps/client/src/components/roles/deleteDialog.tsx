import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
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
	roleId: number;
	roleName: string;
};

export function DeleteDialog({
	roleId,
	roleName,
}: DeleteDialogProps): JSX.Element {
	const queryClient = useQueryClient();

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
					<Button variant="destructive">Delete</Button>
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
							<Button onClick={() => deleteRole(roleId)} variant="destructive">
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
