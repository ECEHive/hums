import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Spinner } from "../ui/spinner";
import { type Role, RoleMultiSelect } from "./role-multiselect";

type User = {
	id: number;
	name: string;
	username: string;
	email: string;
	roles: {
		id: number;
		name: string;
	}[];
};

type RolesDialogProps = {
	user: User;
	trigger?: JSX.Element;
};

export function RolesDialog({ user, trigger }: RolesDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [roles, setRoles] = useState<Role[]>(user.roles);
	const [serverError, setServerError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const queryClient = useQueryClient();

	// Reset local selection when the dialog is closed (discard changes)
	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			// revert to original roles when dialog closed without saving
			setRoles(user.roles);
			setServerError(null);
		}
		setOpen(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger ? (
					trigger
				) : (
					<Button variant="outline" size="sm">
						{user.roles.length} Role{user.roles.length !== 1 ? "s" : ""}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Manage Roles for {user.username}</DialogTitle>
					<DialogDescription>
						Assign or remove roles for this user.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4 space-y-3">
					<div>
						<p className="text-sm text-muted-foreground mb-2">Assigned roles</p>
						{/* RoleMultiSelect allows viewing/searching and selecting roles. Changes are local until Save is pressed. */}
						<RoleMultiSelect
							value={roles}
							onChange={(next: Role[]) => setRoles(next)}
						/>
					</div>
					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}
				</div>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</DialogClose>
					<Button
						onClick={async () => {
							// persist changes
							const previous = user.roles;
							const next = roles;
							const added = next.filter(
								(r) => !previous.find((p) => p.id === r.id),
							);
							const removed = previous.filter(
								(r) => !next.find((p) => p.id === r.id),
							);
							setIsSaving(true);
							setServerError(null);
							try {
								// bulk create for added mappings
								if (added.length > 0) {
									const mappings = added.map((r) => ({
										userId: user.id,
										roleId: r.id,
									}));
									await trpc.userRoles.createBulk.mutate({ mappings });
								}

								// bulk delete for removed mappings
								if (removed.length > 0) {
									const mappings = removed.map((r) => ({
										userId: user.id,
										roleId: r.id,
									}));
									await trpc.userRoles.deleteBulk.mutate({ mappings });
								}

								// refresh queries
								queryClient.invalidateQueries({ queryKey: ["users"] });
								queryClient.invalidateQueries({ queryKey: ["userRoles"] });
								queryClient.invalidateQueries({ queryKey: ["roles"] });

								// close dialog
								setOpen(false);
							} catch (err) {
								const message =
									err instanceof Error ? err.message : String(err);
								setServerError(message);
								setRoles(previous);
							} finally {
								setIsSaving(false);
							}
						}}
						disabled={isSaving}
					>
						{isSaving ? <Spinner /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
