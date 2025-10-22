import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
	location: z
		.string()
		.min(1, "Location is required")
		.min(2, "Location must be at least 2 characters")
		.max(100, "Location must be at most 100 characters"),
	description: z
		.string()
		.max(2000, "Description must be at most 2000 characters")
		.nullable(),
	isBalancedAcrossOverlap: z.boolean(),
	isBalancedAcrossDay: z.boolean(),
	isBalancedAcrossPeriod: z.boolean(),
	canSelfAssign: z.boolean(),
	doRequireRoles: z.enum(["disabled", "all", "any"]),
});

interface ShiftType {
	id: number;
	periodId: number;
	name: string;
	location: string;
	description: string | null;
	color: string | null;
	icon: string | null;
	isBalancedAcrossOverlap: boolean;
	isBalancedAcrossDay: boolean;
	isBalancedAcrossPeriod: boolean;
	canSelfAssign: boolean;
	doRequireRoles: "disabled" | "all" | "any";
	createdAt: Date;
	updatedAt: Date;
}

interface EditShiftTypeSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
	shiftType: ShiftType;
}

export function EditShiftTypeSheet({
	open,
	onOpenChange,
	trigger,
	shiftType,
}: EditShiftTypeSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const formId = useId();

	const updateShiftTypeMutation = useMutation({
		mutationFn: async (input: {
			id: number;
			name: string;
			location: string;
			description: string | null;
			isBalancedAcrossOverlap: boolean;
			isBalancedAcrossDay: boolean;
			isBalancedAcrossPeriod: boolean;
			canSelfAssign: boolean;
			doRequireRoles: "disabled" | "all" | "any";
		}) => {
			return trpc.shiftTypes.update.mutate(input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftTypes", { periodId: shiftType.periodId }],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			name: shiftType.name,
			location: shiftType.location,
			description: shiftType.description as string | null,
			isBalancedAcrossOverlap: shiftType.isBalancedAcrossOverlap,
			isBalancedAcrossDay: shiftType.isBalancedAcrossDay,
			isBalancedAcrossPeriod: shiftType.isBalancedAcrossPeriod,
			canSelfAssign: shiftType.canSelfAssign,
			doRequireRoles: shiftType.doRequireRoles as "disabled" | "all" | "any",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateShiftTypeMutation.mutateAsync({
					id: shiftType.id,
					name: value.name,
					location: value.location,
					description: value.description,
					isBalancedAcrossOverlap: value.isBalancedAcrossOverlap,
					isBalancedAcrossDay: value.isBalancedAcrossDay,
					isBalancedAcrossPeriod: value.isBalancedAcrossPeriod,
					canSelfAssign: value.canSelfAssign,
					doRequireRoles: value.doRequireRoles,
				});
				handleSheetChange(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	// Reset form when shift type changes
	useEffect(() => {
		form.reset();
		setServerError(null);
	}, [shiftType.id, form]);

	const handleSheetChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				form.reset();
				setServerError(null);
			}
		},
		[form, onOpenChange],
	);

	return (
		<Sheet open={open} onOpenChange={handleSheetChange}>
			{trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
			<SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Edit Shift Type</SheetTitle>
					<SheetDescription>
						Update the details for this shift type.
					</SheetDescription>
				</SheetHeader>
				<form
					id={formId}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					noValidate
				>
					<div className="space-y-6 px-4">
						{/* Basic Information */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold">Basic Information</h3>

							<form.Field
								name="name"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>
												Name <span className="text-destructive">*</span>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="e.g., 3D Printing"
												autoComplete="off"
												aria-invalid={isInvalid}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												A descriptive name for this shift type
											</FieldDescription>
										</div>
									);
								}}
							/>

							<form.Field
								name="location"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>
												Location <span className="text-destructive">*</span>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="e.g., Hive Makerspace"
												autoComplete="off"
												aria-invalid={isInvalid}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												The location where this shift takes place
											</FieldDescription>
										</div>
									);
								}}
							/>

							<form.Field
								name="description"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>Description</FieldLabel>
											<Textarea
												id={field.name}
												name={field.name}
												value={field.state.value ?? ""}
												onBlur={field.handleBlur}
												onChange={(e) =>
													field.handleChange(e.target.value || null)
												}
												placeholder="Optional description of this shift type"
												rows={3}
												aria-invalid={isInvalid}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												Additional details about this shift type
											</FieldDescription>
										</div>
									);
								}}
							/>
						</div>

						{/* Balancing Options */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold">Balancing Options</h3>

							<form.Field
								name="isBalancedAcrossOverlap"
								children={(field) => (
									<div className="flex items-start space-x-3">
										<Checkbox
											id={field.name}
											checked={field.state.value}
											onCheckedChange={(checked) =>
												field.handleChange(checked === true)
											}
										/>
										<div className="space-y-1">
											<FieldLabel
												htmlFor={field.name}
												className="font-normal cursor-pointer"
											>
												Balance Across Overlap
											</FieldLabel>
											<FieldDescription>
												Ensure fair distribution when shifts overlap
											</FieldDescription>
										</div>
									</div>
								)}
							/>

							<form.Field
								name="isBalancedAcrossDay"
								children={(field) => (
									<div className="flex items-start space-x-3">
										<Checkbox
											id={field.name}
											checked={field.state.value}
											onCheckedChange={(checked) =>
												field.handleChange(checked === true)
											}
										/>
										<div className="space-y-1">
											<FieldLabel
												htmlFor={field.name}
												className="font-normal cursor-pointer"
											>
												Balance Across Day
											</FieldLabel>
											<FieldDescription>
												Ensure fair distribution throughout each day
											</FieldDescription>
										</div>
									</div>
								)}
							/>

							<form.Field
								name="isBalancedAcrossPeriod"
								children={(field) => (
									<div className="flex items-start space-x-3">
										<Checkbox
											id={field.name}
											checked={field.state.value}
											onCheckedChange={(checked) =>
												field.handleChange(checked === true)
											}
										/>
										<div className="space-y-1">
											<FieldLabel
												htmlFor={field.name}
												className="font-normal cursor-pointer"
											>
												Balance Across Period
											</FieldLabel>
											<FieldDescription>
												Ensure fair distribution across the entire period
											</FieldDescription>
										</div>
									</div>
								)}
							/>
						</div>

						{/* Access & Permissions */}
						<div className="space-y-4">
							<h3 className="text-sm font-semibold">Access & Permissions</h3>

							<form.Field
								name="canSelfAssign"
								children={(field) => (
									<div className="flex items-start space-x-3">
										<Checkbox
											id={field.name}
											checked={field.state.value}
											onCheckedChange={(checked) =>
												field.handleChange(checked === true)
											}
										/>
										<div className="space-y-1">
											<FieldLabel
												htmlFor={field.name}
												className="font-normal cursor-pointer"
											>
												Allow Self-Assignment
											</FieldLabel>
											<FieldDescription>
												Allow users to assign themselves to this shift type
											</FieldDescription>
										</div>
									</div>
								)}
							/>

							<form.Field
								name="doRequireRoles"
								children={(field) => (
									<div className="space-y-2">
										<FieldLabel htmlFor={field.name}>
											Role Requirements
										</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) =>
												field.handleChange(value as "disabled" | "all" | "any")
											}
										>
											<SelectTrigger id={field.name}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="disabled">
													No role requirements
												</SelectItem>
												<SelectItem value="all">
													Require all specified roles
												</SelectItem>
												<SelectItem value="any">
													Require any specified role
												</SelectItem>
											</SelectContent>
										</Select>
										<FieldDescription>
											Control which users can sign up based on their roles
										</FieldDescription>
									</div>
								)}
							/>
						</div>

						{serverError && (
							<div className="rounded-md bg-destructive/10 p-3">
								<p className="text-sm text-destructive">{serverError}</p>
							</div>
						)}
					</div>
				</form>

				<SheetFooter className="pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => handleSheetChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
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
							"Save Changes"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
