import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { useAuth } from "@/auth/AuthProvider";
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
import {
	checkPermissions,
	formatPermissionName,
	formatPermissionType,
	getAllPermissions,
} from "@/lib/permissions";

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

	const currentUser = useAuth().user;
	const canListRolePermissions =
		currentUser && checkPermissions(currentUser, ["rolePermissions.list"]);
	const canEditRolePermissions =
		currentUser &&
		checkPermissions(currentUser, [
			"rolePermissions.create",
			"rolePermissions.delete",
		]);

	const { data } = useQuery({
		queryKey: ["permissions"],
		queryFn: getAllPermissions,
	});

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

	const rolePermissions = useMemo(() => {
		const map = new Map<
			string,
			{ id: number; name: string; assigned: boolean }[]
		>();
		if (data) {
			data.forEach((perms, type) => {
				const permsWithAssignment = perms.map((perm) => ({
					...perm,
					assigned: role.permissions.some((p) => p.id === perm.id),
				}));
				map.set(type, permsWithAssignment);
			});
		}
		return map;
	}, [data, role.permissions]);

	// Local assignment state for optimistic UI updates
	const [assignedById, setAssignedById] = useState<Record<number, boolean>>({});

	useEffect(() => {
		const next: Record<number, boolean> = {};
		rolePermissions.forEach((perms) => {
			perms.forEach((p) => {
				next[p.id] = p.assigned;
			});
		});
		setAssignedById(next);
	}, [rolePermissions]);

	// Determine if an entire section is selected
	const areAllSelected = useCallback(
		(perms: { id: number; name: string; assigned: boolean }[]) =>
			perms.every((p) => (assignedById[p.id] ?? p.assigned) === true),
		[assignedById],
	);

	// Toggle all in a section: selects all if any unselected, otherwise deselects all
	const toggleAllInSection = useCallback(
		async (perms: { id: number; name: string; assigned: boolean }[]) => {
			const allSelected = areAllSelected(perms);
			const targets = perms.filter(
				(p) =>
					allSelected
						? (assignedById[p.id] ?? p.assigned) === true // deselect these
						: (assignedById[p.id] ?? p.assigned) !== true, // select these
			);

			if (targets.length === 0) return;

			// Optimistic local update
			setAssignedById((prev) => {
				const next = { ...prev };
				targets.forEach((p) => {
					next[p.id] = !allSelected;
				});
				return next;
			});

			await Promise.all(
				targets.map((p) =>
					updateRolePermissionMutation.mutateAsync({
						roleId: role.id,
						permissionId: p.id,
						assigned: !allSelected,
					}),
				),
			);
		},
		[areAllSelected, assignedById, role.id, updateRolePermissionMutation],
	);

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) queryClient.invalidateQueries({ queryKey: ["roles"] });
			}}
		>
			<form>
				<DialogTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						disabled={!canListRolePermissions}
					>
						Edit {role.permissions.length} permission
						{role.permissions.length !== 1 ? "s" : ""}
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-full">
					<DialogHeader>
						<DialogTitle>Permissions for {role.name}</DialogTitle>
						<DialogDescription>Changes saved automatically.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap gap-1">
						{Array.from(rolePermissions.entries()).map(([type, perms]) => (
							<div key={type} className="w-full">
								<div className="flex items-center justify-between mt-4 mb-2">
									<h3 className="font-medium">{formatPermissionType(type)}</h3>
									<Button
										variant="ghost"
										size="sm"
										onClick={async () => {
											if (!canEditRolePermissions) return;
											await toggleAllInSection(perms);
										}}
										disabled={
											updateRolePermissionMutation.isPending ||
											!canEditRolePermissions
										}
									>
										{areAllSelected(perms) ? "Deselect all" : "Select all"}
									</Button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									{perms.map((perm) => (
										<Label
											key={perm.id}
											className="flex items-center space-x-2"
										>
											<Checkbox
												onCheckedChange={(checked) => {
													if (!canEditRolePermissions) return;
													// Optimistic local update
													setAssignedById((prev) => ({
														...prev,
														[perm.id]: checked === true,
													}));
													updateRolePermissionMutation.mutate({
														roleId: role.id,
														permissionId: perm.id,
														assigned: checked === true,
													});
												}}
												disabled={
													updateRolePermissionMutation.isPending ||
													!canEditRolePermissions
												}
												checked={assignedById[perm.id] ?? perm.assigned}
											/>
											<span>{formatPermissionName(perm.name)}</span>
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
