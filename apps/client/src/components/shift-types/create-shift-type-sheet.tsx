import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useId, useState } from "react";
import { z } from "zod";
import { ColorPicker } from "@/components/color-picker";
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
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
	color: z
		.string()
		.regex(/^#([0-9a-fA-F]{3}){1,2}$/)
		.nullable(),
	isBalancedAcrossOverlap: z.boolean(),
	isBalancedAcrossDay: z.boolean(),
	isBalancedAcrossPeriod: z.boolean(),
	canSelfAssign: z.boolean(),
	doRequireRoles: z.enum(["disabled", "all", "any"]),
});

interface CreateShiftTypeSheetProps {
	periodId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger?: React.ReactNode;
}

export function CreateShiftTypeSheet({
	periodId,
	open,
	onOpenChange,
	trigger,
}: CreateShiftTypeSheetProps) {
	const queryClient = useQueryClient();
	const [serverError, setServerError] = useState<string | null>(null);
	const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
	const formId = useId();

	const createShiftTypeMutation = useMutation({
		mutationFn: async (input: {
			name: string;
			location: string;
			description: string | null;
			color: string | null;
			isBalancedAcrossOverlap: boolean;
			isBalancedAcrossDay: boolean;
			isBalancedAcrossPeriod: boolean;
			canSelfAssign: boolean;
			doRequireRoles: "disabled" | "all" | "any";
			roleIds?: number[];
		}) => {
			return trpc.shiftTypes.create.mutate({
				periodId,
				...input,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["shiftTypes", { periodId }],
			});
		},
	});

	const form = useForm({
		defaultValues: {
			name: "",
			location: "",
			description: null as string | null,
			isBalancedAcrossOverlap: false,
			isBalancedAcrossDay: false,
			isBalancedAcrossPeriod: false,
			canSelfAssign: true,
			doRequireRoles: "disabled" as "disabled" | "all" | "any",
			color: null as string | null,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				// Create the shift type with roleIds
				await createShiftTypeMutation.mutateAsync({
					name: value.name,
					location: value.location,
					description: value.description,
					isBalancedAcrossOverlap: value.isBalancedAcrossOverlap,
					isBalancedAcrossDay: value.isBalancedAcrossDay,
					isBalancedAcrossPeriod: value.isBalancedAcrossPeriod,
					canSelfAssign: value.canSelfAssign,
					doRequireRoles: value.doRequireRoles,
					color: value.color ?? null,
					roleIds:
						selectedRoles.length > 0
							? selectedRoles.map((r) => r.id)
							: undefined,
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

	const handleSheetChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				form.reset();
				setSelectedRoles([]);
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
					<SheetTitle>Create New Shift Type</SheetTitle>
					<SheetDescription>
						Create a new shift type for this period.
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

							<form.Field
								name="color"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;

									const hex = field.state.value as string | null;
									const hexToRgb = (h: string | null) => {
										if (!h) return { r: 110, g: 170, b: 230 };
										const v = h.replace(/^#/, "");
										const full =
											v.length === 3
												? v
														.split("")
														.map((c) => c + c)
														.join("")
												: v;
										const r = Number.parseInt(full.substring(0, 2), 16);
										const g = Number.parseInt(full.substring(2, 4), 16);
										const b = Number.parseInt(full.substring(4, 6), 16);
										return { r, g, b };
									};

									return (
										<div className="space-y-2">
											<FieldLabel htmlFor={field.name}>Color</FieldLabel>
											<ColorPicker
												initial={hexToRgb(hex)}
												value={hex}
												onChange={(_, __, hex) => field.handleChange(hex)}
												optional
												onClear={() => field.handleChange(null)}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
											<FieldDescription>
												Optional color used to render this shift type in
												calendars and timelines
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

						{/* Shift Type Roles */}
						<form.Subscribe
							selector={(state) => state.values.doRequireRoles}
							children={(doRequireRoles) => {
								if (doRequireRoles === "disabled") return null;

								return (
									<div className="space-y-4">
										<div className="space-y-2">
											<FieldLabel>Required Roles</FieldLabel>
											<RoleMultiSelect
												value={selectedRoles}
												onChange={setSelectedRoles}
												placeholder="Select roles..."
											/>
											<FieldDescription>
												{doRequireRoles === "all"
													? "Users must have all of these roles to sign up"
													: "Users must have at least one of these roles to sign up"}
											</FieldDescription>
										</div>
									</div>
								);
							}}
						/>

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
								Creating...
							</>
						) : (
							"Create Shift Type"
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
