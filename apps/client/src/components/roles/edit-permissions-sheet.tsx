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
import { Spinner } from "@/components/ui/spinner";
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
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	const currentUser = useAuth().user;
	const canListPermissions =
		currentUser && checkPermissions(currentUser, ["permissions.list"]);
	const canEditRole =
		currentUser && checkPermissions(currentUser, ["roles.update"]);

	const { data } = useQuery({
		queryKey: ["permissions"],
		queryFn: getAllPermissions,
	});

	const updateRolePermissionsMutation = useMutation({
		mutationFn: async ({
			roleId,
			permissionIds,
		}: {
			roleId: number;
			permissionIds: number[];
		}) => {
			return await trpc.roles.update.mutate({
				id: roleId,
				name: role.name,
				permissionIds,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["roles"] });
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

	// Local assignment state for UI updates
	const [assignedById, setAssignedById] = useState<Record<number, boolean>>({});

	// Initialize local state when sheet opens or role changes
	useEffect(() => {
		if (open) {
			const next: Record<number, boolean> = {};
			rolePermissions.forEach((perms) => {
				perms.forEach((p) => {
					next[p.id] = p.assigned;
				});
			});
			setAssignedById(next);
			setServerError(null);
		}
	}, [rolePermissions, open]);

	// Check if there are unsaved changes
	const hasChanges = useMemo(() => {
		const currentIds = role.permissions.map((p) => p.id).sort();
		const newIds = Object.entries(assignedById)
			.filter(([, assigned]) => assigned)
			.map(([id]) => Number(id))
			.sort();
		return JSON.stringify(currentIds) !== JSON.stringify(newIds);
	}, [role.permissions, assignedById]);

	// Determine if an entire section is selected
	const areAllSelected = useCallback(
		(perms: { id: number; name: string; assigned: boolean }[]) =>
			perms.every((p) => (assignedById[p.id] ?? p.assigned) === true),
		[assignedById],
	);

	// Toggle all in a section: selects all if any unselected, otherwise deselects all
	const toggleAllInSection = useCallback(
		(perms: { id: number; name: string; assigned: boolean }[]) => {
			const allSelected = areAllSelected(perms);
			const newAssignment = { ...assignedById };

			perms.forEach((p) => {
				newAssignment[p.id] = !allSelected;
			});

			// Local update only - don't save yet
			setAssignedById(newAssignment);
		},
		[areAllSelected, assignedById],
	);

	// Handle save
	const handleSave = useCallback(async () => {
		const permissionIds = Object.entries(assignedById)
			.filter(([, assigned]) => assigned)
			.map(([id]) => Number(id));

		try {
			await updateRolePermissionsMutation.mutateAsync({
				roleId: role.id,
				permissionIds,
			});
			setOpen(false);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setServerError(message);
		}
	}, [assignedById, role.id, updateRolePermissionsMutation]);

	// Handle sheet close - reset to original state
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				// Reset local state to original
				const original: Record<number, boolean> = {};
				rolePermissions.forEach((perms) => {
					perms.forEach((p) => {
						original[p.id] = p.assigned;
					});
				});
				setAssignedById(original);
				setServerError(null);
			}
		},
		[rolePermissions],
	);

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>
				<Button variant="outline" size="sm" disabled={!canListPermissions}>
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
					<SheetDescription>
						Select permissions and click Save to apply changes.
					</SheetDescription>
				</SheetHeader>
				<Accordion type="multiple" className="space-y-2 px-4 sm:px-6">
					{Array.from(rolePermissions.entries()).map(([type, perms]) => (
						<AccordionItem key={type} value={type}>
							<AccordionTrigger className="items-center">
								<div className="flex items-center gap-3 flex-1">
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
											className="py-1 leading-none"
											onClick={(e) => {
												// Prevent trigger toggle when clicking the select all button
												e.stopPropagation();
												if (!canEditRole) return;
												toggleAllInSection(perms);
											}}
											disabled={!canEditRole}
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
													if (!canEditRole) return;

													// Local update only - don't save yet
													setAssignedById((prev) => ({
														...prev,
														[perm.id]: checked === true,
													}));
												}}
												disabled={!canEditRole}
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

				{serverError && (
					<div className="px-4 sm:px-6 mt-4">
						<p className="text-sm text-destructive">{serverError}</p>
					</div>
				)}

				<SheetFooter className="mt-4">
					<SheetClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</SheetClose>
					<Button
						onClick={handleSave}
						disabled={
							!canEditRole ||
							!hasChanges ||
							updateRolePermissionsMutation.isPending
						}
					>
						{updateRolePermissionsMutation.isPending ? (
							<>
								<Spinner className="mr-2 size-4" />
								Saving...
							</>
						) : (
							"Save"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
