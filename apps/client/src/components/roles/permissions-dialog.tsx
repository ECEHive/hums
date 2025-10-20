import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getAllPermissions } from "@/lib/permissions";

type PermissionsDialogProps = {
	role: {
		id: number;
		name: string;
		permissions: { id: number; name: string }[];
	};
};

export function PermissionsDialog({
	role,
}: PermissionsDialogProps): JSX.Element {
	const queryClient = useQueryClient();

	const updateRolePermissionMutation = useMutation({
		mutationFn: async ({
			roleId,
			permissionId,
			assigned,
		}: {
			roleId: number;
			permissionId: number;
			assigned: boolean;
		}) => {
			if (assigned) {
				return await trpc.rolePermissions.create.mutate({
					roleId: roleId,
					permissionId: permissionId,
				});
			} else {
				return await trpc.rolePermissions.delete.mutate({
					roleId: roleId,
					permissionId: permissionId,
				});
			}
		},
	});

	const rolePermissions = new Map<
		string,
		{ id: number; name: string; assigned: boolean }[]
	>();

	const { data } = useQuery({
		queryKey: ["permissions"],
		queryFn: getAllPermissions,
	});

	// Iterate through permissions to mark assigned ones in rolePermissions map
	data?.forEach((perms, type) => {
		const permsWithAssignment = perms.map((perm) => ({
			...perm,
			assigned: role.permissions.some((p) => p.id === perm.id),
		}));
		rolePermissions.set(type, permsWithAssignment);
	});

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) queryClient.invalidateQueries({ queryKey: ["roles"] });
			}}
		>
			<form>
				<DialogTrigger asChild>
					<Button variant="outline">
						Edit {role.permissions.length} permission
						{role.permissions.length !== 1 ? "s" : ""}
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Permissions for {role.name}</DialogTitle>
						<DialogDescription>Changes saved automatically.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap gap-1">
						{Array.from(rolePermissions.entries()).map(([type, perms]) => (
							<div key={type} className="w-full">
								<h3 className="font-medium mt-4 mb-2">
									{type
										.replace(/[_-]/g, " ")
										.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
										.split(" ")
										.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
										.join(" ")}
								</h3>
								<div className="grid grid-cols-2 gap-2">
									{perms.map((perm) => (
										<Label
											key={perm.id}
											className="flex items-center space-x-2"
										>
											<Checkbox
												onCheckedChange={(checked) =>
													updateRolePermissionMutation.mutate({
														roleId: role.id,
														permissionId: perm.id,
														assigned: checked === true,
													})
												}
												defaultChecked={perm.assigned}
											/>
											<span>{perm.name.split(".").pop()}</span>
										</Label>
									))}
								</div>
							</div>
						))}
					</div>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Close</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</form>
		</Dialog>
	);
}
