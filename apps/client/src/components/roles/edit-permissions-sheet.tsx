import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { useAuth } from "@/auth/AuthProvider";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	checkPermissions,
	formatPermissionName,
	formatPermissionType,
	getAllPermissions,
} from "@/lib/permissions";

type EditPermissionsSheetProps = {
	role: {
		id: number;
		name: string;
		permissions: { id: number; name: string }[];
	};
};

export function EditPermissionsSheet({
	role,
}: EditPermissionsSheetProps): JSX.Element {
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
		<Sheet
			onOpenChange={(open) => {
				if (!open) queryClient.invalidateQueries({ queryKey: ["roles"] });
			}}
		>
			<form>
				<SheetTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						disabled={!canListRolePermissions}
					>
						Edit {role.permissions.length} permission
						{role.permissions.length !== 1 ? "s" : ""}
					</Button>
				</SheetTrigger>
				<SheetContent
					side="right"
					className="w-full sm:max-w-[540px] overflow-y-auto max-h-full"
				>
					<SheetHeader>
						<SheetTitle>Permissions for {role.name}</SheetTitle>
						<SheetDescription>Changes saved automatically.</SheetDescription>
					</SheetHeader>
					<Accordion type="multiple" className="space-y-2 px-4 sm:px-6">
						{Array.from(rolePermissions.entries()).map(([type, perms]) => (
							<AccordionItem key={type} value={type}>
								<AccordionTrigger>
									<div
										style={{ paddingBottom: "1.25%" }}
										className="flex items-center gap-3 flex-1"
									>
										<div className="flex gap-3 flex-1">
											<h3 className="font-medium leading-none">
												{formatPermissionType(type)}
											</h3>
											<span className="text-sm text-muted-foreground leading-none">
												{
													perms.filter((p) => assignedById[p.id] ?? p.assigned)
														.length
												}
												/{perms.length}
											</span>
										</div>
										<div className="flex items-center">
											<Button
												variant="ghost"
												size="sm"
												className="py-0 leading-none"
												onClick={async (e) => {
													// Prevent trigger toggle when clicking the select all button
													e.stopPropagation();
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
									</div>
								</AccordionTrigger>
								<AccordionContent>
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
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
					<SheetFooter>
						<SheetClose asChild>
							<Button variant="outline">Close</Button>
						</SheetClose>
					</SheetFooter>
				</SheetContent>
			</form>
		</Sheet>
	);
}
