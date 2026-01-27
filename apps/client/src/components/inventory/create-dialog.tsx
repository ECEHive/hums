import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
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
	const queryClient = useQueryClient();
	const formId = useId();

	type CreateItemInput = {
		name: string;
		description?: string;
		sku?: string;
		location?: string;
		minQuantity?: number;
		isActive?: boolean;
		initialQuantity?: number;
	};

	type FormValues = CreateItemInput;

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
				await createItemMutation.mutateAsync(value);
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
			// When opening the dialog, reset the form and give a fresh SKU.
			if (nextOpen) {
				form.reset({
					name: "",
					description: "",
					sku: generateSku(),
					location: "",
					minQuantity: undefined,
					isActive: true,
					initialQuantity: undefined,
				});
				setServerError(null);
				return;
			}

			// On close, clear form to defaults
			form.reset();
			setServerError(null);
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["inventory.items.create"]);
	const canCreateSnapshot =
		user && checkPermissions(user, ["inventory.snapshots.create"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button hidden={!canCreate}>New Item</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Create Item</DialogTitle>
					<DialogDescription>
						Create a new inventory item. Optionally provide an initial quantity
						to create a snapshot.
					</DialogDescription>
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
						{isSubmitting ? <Spinner /> : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
