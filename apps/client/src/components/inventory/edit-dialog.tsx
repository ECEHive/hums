import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";
import { RoleMultiSelect, type Role } from "@/components/roles/role-multiselect";

const formSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
	link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	isActive: z.boolean().optional(),
});

type EditDialogProps = {
	item: {
		id: string;
		name: string;
		description?: string | null;
		sku?: string | null;
		location?: string | null;
		minQuantity?: number | null;
		link?: string | null;
		isActive: boolean;
		approvalRoles?: { id: number; name: string }[];
	};
	onUpdate?: () => void;
};

export function EditDialog({ item, onUpdate }: EditDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [approvalRoles, setApprovalRoles] = useState<Role[]>(
		item.approvalRoles ?? [],
	);
	const queryClient = useQueryClient();
	const formId = useId();

	type UpdateItemInput = {
		id: string;
		name?: string;
		description?: string;
		sku?: string;
		location?: string;
		minQuantity?: number;
		link?: string;
		isActive?: boolean;
		approvalRoleIds?: number[];
	};

	const updateItemMutation = useMutation({
		mutationFn: (input: UpdateItemInput) =>
			trpc.inventory.items.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
		},
	});

	const createSnapshotMutation = useMutation({
		mutationFn: (input: { itemId: string; quantity: number }) =>
			trpc.inventory.snapshots.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
		},
	});

	type FormValues = UpdateItemInput & { quantity?: number | null };

	const form = useForm<FormValues>({
		defaultValues: {
			id: item.id,
			name: item.name,
			description: item.description ?? "",
			sku: item.sku ?? "",
			location: item.location ?? "",
			minQuantity: item.minQuantity ?? undefined,
			link: item.link ?? "",
			quantity: undefined,
			isActive: item.isActive,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const { quantity, ...updateData } = value;

				// Convert empty strings and null to undefined for optional fields
				const cleanedData: UpdateItemInput = {
					...updateData,
					description: updateData.description || undefined,
					sku: updateData.sku || undefined,
					location: updateData.location || undefined,
					minQuantity: updateData.minQuantity ?? undefined,
					approvalRoleIds: approvalRoles.map((r) => r.id),
				};

				await updateItemMutation.mutateAsync(cleanedData);

				if (quantity !== undefined && quantity !== null) {
					if (user && checkPermissions(user, ["inventory.snapshots.create"])) {
						await createSnapshotMutation.mutateAsync({
							itemId: item.id,
							quantity,
						});
					} else {
						setServerError(
							"You do not have permission to set item quantity snapshots.",
						);
						return;
					}
				}

				setOpen(false);
				onUpdate?.();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	const handleDialogChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				form.reset();
				setApprovalRoles(item.approvalRoles ?? []);
				setServerError(null);
			} else {
				// When opening, reset to current item values
				setApprovalRoles(item.approvalRoles ?? []);
				setServerError(null);
			}
		},
		[form, item.approvalRoles],
	);

	const user = useAuth().user;
	const canEdit = user && checkPermissions(user, ["inventory.items.update"]);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					hidden={!canEdit}
					aria-label={`Edit ${item.name}`}
				>
					<PencilIcon className="h-4 w-4" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Edit Item</SheetTitle>
					<SheetDescription>Update item details.</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					className="space-y-4 px-4 sm:px-6 mt-4"
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<form.Field name="name">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Name</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter name"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="sku">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									SKU <span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter SKU"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Description{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter short description"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="location">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Location{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter location"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="link">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Link <span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="Enter ordering/product URL"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="minQuantity">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Minimum Quantity{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									onBlur={field.handleBlur}
									placeholder="Enter minimum quantity"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="quantity">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Quantity{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									onBlur={field.handleBlur}
									placeholder="Set authoritative quantity (creates snapshot)"
									disabled={
										!user ||
										!checkPermissions(user, ["inventory.snapshots.create"])
									}
								/>
								<p className="text-xs text-muted-foreground">
									Provide a quantity to create an authoritative snapshot for
									this item.
								</p>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="isActive">
						{(field) => (
							<Field>
								<div className="flex items-center space-x-2">
									<Checkbox
										id={field.name}
										checked={field.state.value}
										onCheckedChange={(checked) => field.handleChange(!!checked)}
										onBlur={field.handleBlur}
									/>
									<FieldLabel htmlFor={field.name} className="!mt-0">
										Active
									</FieldLabel>
								</div>
								<p className="text-xs text-muted-foreground">
									Inactive items will be hidden by default.
								</p>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<Field>
						<FieldLabel>
							Checkout/Return Approval Roles{" "}
							<span className="text-muted-foreground">(optional)</span>
						</FieldLabel>
						<RoleMultiSelect
							value={approvalRoles}
							onChange={setApprovalRoles}
							placeholder="Select roles that can approve..."
						/>
						<p className="text-xs text-muted-foreground">
							If set, checkout or return of this item will require approval from
							a user with any of the selected roles.
						</p>
					</Field>

					{serverError && (
						<div className="text-sm text-destructive">{serverError}</div>
					)}
				</form>
				<SheetFooter className="mt-4">
					<SheetClose asChild>
						<Button variant="outline" disabled={isSubmitting}>
							Cancel
						</Button>
					</SheetClose>
					<Button
						form={formId}
						type="submit"
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? (
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
