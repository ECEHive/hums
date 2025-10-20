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

export function CreateDialog(): JSX.Element {
	const queryClient = useQueryClient();
	const nameInputId = useId();

	const [roleName, setRoleName] = useState("");

	const createRole = async (roleName: string) => {
		try {
			await trpc.roles.create.mutate({ name: roleName });

			// Invalidate the roles query to refresh data
			queryClient.invalidateQueries({ queryKey: ["roles"] });
		} catch (err) {
			console.error("Failed to create role:", err);
		}
	};

	return (
		<Dialog>
			<form>
				<DialogTrigger asChild>
					<Button variant="outline">Create Role</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Creating new role</DialogTitle>
						<DialogDescription>
							Enter a name for the new role.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap gap-1">
						<Label htmlFor={nameInputId}>Role Name</Label>
						<input
							type="text"
							id={nameInputId}
							name="roleName"
							value={roleName}
							onChange={(e) => setRoleName(e.target.value)}
							className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button
								onClick={() => {
									createRole(roleName);
								}}
							>
								Create
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
