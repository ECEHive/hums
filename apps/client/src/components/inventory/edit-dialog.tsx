import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
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
		isActive: boolean;
	};
	onUpdate?: () => void;
};

export function EditDialog({ item, onUpdate }: EditDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	type UpdateItemInput = {
		id: string;
		name?: string;
		description?: string | null;
		sku?: string | null;
		location?: string | null;
		minQuantity?: number | null;
		isActive?: boolean;
	};

	const updateItemMutation = useMutation<
		UpdateItemInput,
		unknown,
		UpdateItemInput
	>({
		mutationFn: (input: UpdateItemInput) =>
			trpc.inventory.items.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory", "items"] });
		},
	});

	const createSnapshotMutation = useMutation<
		{ itemId: string; quantity: number },
		unknown,
		{ itemId: string; quantity: number }
	>({
		mutationFn: (input) => trpc.inventory.snapshots.create.mutate(input),
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
			quantity: undefined,
			isActive: item.isActive,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const { quantity, ...updateData } = value;

				await updateItemMutation.mutateAsync(updateData as UpdateItemInput);

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
				setServerError(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canEdit = user && checkPermissions(user, ["inventory.items.update"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					hidden={!canEdit}
					aria-label={`Edit ${item.name}`}
				>
					<PencilIcon className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Edit Item</DialogTitle>
					<DialogDescription>Update item details.</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					className="space-y-4"
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

					{serverError && (
						<div className="text-sm text-destructive">{serverError}</div>
					)}
				</form>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline" disabled={isSubmitting}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						form={formId}
						type="submit"
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? <Spinner /> : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
