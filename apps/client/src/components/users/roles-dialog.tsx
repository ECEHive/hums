import { trpc } from "@ecehive/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
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
import { type Role, RoleMultiSelect } from "../roles/role-multiselect";
import { Spinner } from "../ui/spinner";

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

	const currentUser = useAuth().user;
	const canUpdate =
		currentUser && checkPermissions(currentUser, ["users.update"]);

	const permissionDisabled = !canUpdate;

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
							// persist changes via users.update with roleIds
							const previous = user.roles;
							const roleIds = roles.map((r) => r.id);

							setIsSaving(true);
							setServerError(null);
							try {
								await trpc.users.update.mutate({
									id: user.id,
									name: user.name,
									email: user.email,
									roleIds,
								});

								// refresh queries
								queryClient.invalidateQueries({ queryKey: ["users"] });
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
						disabled={isSaving || permissionDisabled}
					>
						{isSaving ? <Spinner /> : "Save"}
					</Button>
					{permissionDisabled && (
						<p className="text-sm text-muted-foreground mt-2">
							You don't have permission to update user roles.
						</p>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
