import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
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
import { Label } from "@/components/ui/label";

type RenameDialogProps = {
	roleId: number;
	currentName: string;
};

export function RenameDialog({
	roleId,
	currentName,
}: RenameDialogProps): JSX.Element {
	const queryClient = useQueryClient();
	const nameInputId = useId();

	const [newName, setNewName] = useState(currentName);

	const updateRoleName = async (newName: string) => {
		try {
			await trpc.roles.update.mutate({ id: roleId, name: newName });

			// Invalidate the roles query to refresh data
			queryClient.invalidateQueries({ queryKey: ["roles"] });
		} catch (err) {
			console.error("Failed to update role name:", err);
		}
	};

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button variant="outline">Rename</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Renaming {currentName}</DialogTitle>
						<DialogDescription>Press rename to save changes.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap gap-1">
						<Label htmlFor={nameInputId}>Role Name</Label>
						<input
							type="text"
							id={nameInputId}
							name="roleName"
							onChange={(e) => setNewName(e.target.value)}
							value={newName}
							className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								onClick={() => {
									updateRoleName(newName);
								}}
							>
								Rename
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
