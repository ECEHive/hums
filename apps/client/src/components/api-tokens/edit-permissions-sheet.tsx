import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { ApiTokenRow } from "./types";

type EditTokenPermissionsSheetProps = {
	token: ApiTokenRow;
};

export function EditTokenPermissionsSheet({
	token,
}: EditTokenPermissionsSheetProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	const currentUser = useAuth().user;
	const canListPermissions =
		currentUser && checkPermissions(currentUser, ["permissions.list"]);
	const canEditToken =
		currentUser && checkPermissions(currentUser, ["api_tokens.create"]);

	const { data } = useQuery({
		queryKey: ["permissions"],
		queryFn: getAllPermissions,
	});

	const updatePermissionsMutation = useMutation({
		mutationFn: async ({
			tokenId,
			permissionIds,
		}: {
			tokenId: number;
			permissionIds: number[];
		}) => {
			return await trpc.apiTokens.updatePermissions.mutate({
				id: tokenId,
				permissionIds,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
		},
	});

	const tokenPermissions = useMemo(() => {
		const map = new Map<
			string,
			{ id: number; name: string; assigned: boolean }[]
		>();
		if (data) {
			data.forEach((perms, type) => {
				map.set(
					type,
					perms.map((perm) => ({
						...perm,
						assigned: token.permissions.some((p) => p.id === perm.id),
					})),
				);
			});
		}
		return map;
	}, [data, token.permissions]);

	const [assignedById, setAssignedById] = useState<Record<number, boolean>>({});

	useEffect(() => {
		if (open) {
			const next: Record<number, boolean> = {};
			tokenPermissions.forEach((perms) => {
				perms.forEach((p) => {
					next[p.id] = p.assigned;
				});
			});
			setAssignedById(next);
			setServerError(null);
		}
	}, [tokenPermissions, open]);

	const hasChanges = useMemo(() => {
		const currentIds = token.permissions.map((p) => p.id).sort((a, b) => a - b);
		const newIds = Object.entries(assignedById)
			.filter(([, assigned]) => assigned)
			.map(([id]) => Number(id))
			.sort((a, b) => a - b);
		return JSON.stringify(currentIds) !== JSON.stringify(newIds);
	}, [token.permissions, assignedById]);

	const areAllSelected = useCallback(
		(perms: { id: number; name: string; assigned: boolean }[]) =>
			perms.every((p) => (assignedById[p.id] ?? p.assigned) === true),
		[assignedById],
	);

	const toggleAllInSection = useCallback(
		(perms: { id: number; name: string; assigned: boolean }[]) => {
			const allSelected = areAllSelected(perms);
			const newAssignment = { ...assignedById };
			perms.forEach((p) => {
				newAssignment[p.id] = !allSelected;
			});
			setAssignedById(newAssignment);
		},
		[areAllSelected, assignedById],
	);

	const handleSave = useCallback(async () => {
		const permissionIds = Object.entries(assignedById)
			.filter(([, assigned]) => assigned)
			.map(([id]) => Number(id));
		try {
			await updatePermissionsMutation.mutateAsync({
				tokenId: token.id,
				permissionIds,
			});
			setOpen(false);
		} catch (err) {
			setServerError(err instanceof Error ? err.message : String(err));
		}
	}, [assignedById, token.id, updatePermissionsMutation]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				const original: Record<number, boolean> = {};
				tokenPermissions.forEach((perms) => {
					perms.forEach((p) => {
						original[p.id] = p.assigned;
					});
				});
				setAssignedById(original);
				setServerError(null);
			}
		},
		[tokenPermissions],
	);

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>
				<Button variant="outline" size="sm" disabled={!canListPermissions}>
					Edit {token.permissions.length} permission
					{token.permissions.length !== 1 ? "s" : ""}
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[540px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Permissions for {token.name}</SheetTitle>
					<SheetDescription>
						Select the permissions this API token should have. Tokens can only
						access endpoints for which they have been granted permissions.
					</SheetDescription>
				</SheetHeader>
				<Accordion type="multiple" className="space-y-2 px-4 sm:px-6">
					{Array.from(tokenPermissions.entries()).map(([type, perms]) => (
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
												e.stopPropagation();
												if (!canEditToken) return;
												toggleAllInSection(perms);
											}}
											disabled={!canEditToken}
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
													if (!canEditToken) return;
													setAssignedById((prev) => ({
														...prev,
														[perm.id]: checked === true,
													}));
												}}
												disabled={!canEditToken}
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
							!canEditToken ||
							!hasChanges ||
							updatePermissionsMutation.isPending
						}
					>
						{updatePermissionsMutation.isPending ? (
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
