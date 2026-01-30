import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
	link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	isActive: z.boolean().optional(),
	initialQuantity: z.number().int().min(0).optional(),
});

function generateSku(): string {
	// 4 chars from current milliseconds timestamp in base36 (padded) + 4 random base36 chars
	const tsPart = Date.now()
		.toString(36)
		.slice(-4)
		.padStart(4, "0")
		.toUpperCase();

	const randPart = Array.from({ length: 4 })
		.map(() => Math.floor(Math.random() * 36).toString(36))
		.join("")
		.toUpperCase();

	return `${tsPart}${randPart}`;
}

type CreateDialogProps = {
	onUpdate?: () => void;
};

export function CreateDialog({ onUpdate }: CreateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [approvalRoles, setApprovalRoles] = useState<Role[]>([]);
	const queryClient = useQueryClient();
	const formId = useId();

	type CreateItemInput = {
		name: string;
		description?: string;
		sku?: string;
		location?: string;
		minQuantity?: number;
		link?: string;
		isActive?: boolean;
		initialQuantity?: number;
		approvalRoleIds?: number[];
	};

	type FormValues = Omit<CreateItemInput, "approvalRoleIds">;

	const createItemMutation = useMutation({
		mutationFn: (input: CreateItemInput) =>
			trpc.inventory.items.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
		},
	});

	const form = useForm<FormValues>({
		defaultValues: {
			name: "",
			description: "",
			sku: generateSku(),
			location: "",
			minQuantity: undefined,
			link: "",
			isActive: true,
			initialQuantity: undefined,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				if (
					value.initialQuantity !== undefined &&
					value.initialQuantity !== null &&
					!canCreateSnapshot
				) {
					setServerError(
						"You do not have permission to set initial item quantity snapshots.",
					);
					return;
				}
				await createItemMutation.mutateAsync({
					...value,
					approvalRoleIds: approvalRoles.map((r) => r.id),
				});
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
			// When opening the sheet, reset the form and give a fresh SKU.
			if (nextOpen) {
				form.reset({
					name: "",
					description: "",
					sku: generateSku(),
					location: "",
					minQuantity: undefined,
					link: "",
					isActive: true,
					initialQuantity: undefined,
				});
				setApprovalRoles([]);
				setServerError(null);
				return;
			}

			// On close, clear form to defaults
			form.reset();
			setApprovalRoles([]);
			setServerError(null);
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["inventory.items.create"]);
	const canCreateSnapshot =
		user && checkPermissions(user, ["inventory.snapshots.create"]);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button hidden={!canCreate}>New Item</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Create Item</SheetTitle>
					<SheetDescription>
						Create a new inventory item. Optionally provide an initial quantity
						to create a snapshot.
					</SheetDescription>
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
									value={field.state.value}
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
									value={field.state.value}
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
									value={field.state.value}
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
									value={field.state.value}
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

					<form.Field name="initialQuantity">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>
									Initial Quantity{" "}
									<span className="text-muted-foreground">(optional)</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									onBlur={field.handleBlur}
									placeholder="Enter initial quantity"
									disabled={!canCreateSnapshot}
								/>
								<p className="text-xs text-muted-foreground">
									Provide an initial quantity to create an authoritative
									snapshot for this item.
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
								Creating...
							</>
						) : (
							"Create"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
