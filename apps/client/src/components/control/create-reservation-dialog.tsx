import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { parseDateTimeInput } from "@/components/suspensions/datetime";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkPermissions } from "@/lib/permissions";
import { dayjs } from "@/lib/timezone";
import { cn } from "@/lib/utils";

const formSchema = z.object({
	controlPointId: z.string().min(1, "Control point is required"),
	startDate: z.string().min(1, "Start date is required"),
	startTime: z.string().min(1, "Start time is required"),
	endDate: z.string().min(1, "End date is required"),
	endTime: z.string().min(1, "End time is required"),
	notes: z.string().max(1000).optional(),
});

type CreateReservationDialogProps = {
	onUpdate?: () => void;
};

export function CreateReservationDialog({
	onUpdate,
}: CreateReservationDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
	const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
	const queryClient = useQueryClient();
	const formId = useId();

	const { data: reservablePoints = [] } = useQuery({
		queryKey: ["control", "reservations", "reservablePoints"],
		queryFn: () => trpc.control.reservations.reservablePoints.query(),
		enabled: open,
	});

	const createMutation = useMutation({
		mutationFn: (input: {
			controlPointId: string;
			startTime: Date;
			endTime: Date;
			notes?: string;
		}) => trpc.control.reservations.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "reservations"] });
		},
	});

	const form = useForm({
		defaultValues: {
			controlPointId: "",
			startDate: "",
			startTime: "",
			endDate: "",
			endTime: "",
			notes: "",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const startTime = parseDateTimeInput(value.startDate, value.startTime);
				const endTime = parseDateTimeInput(value.endDate, value.endTime);

				if (!startTime || !endTime) {
					setServerError("Invalid date or time format");
					return;
				}

				if (endTime <= startTime) {
					setServerError("End time must be after start time");
					return;
				}

				await createMutation.mutateAsync({
					controlPointId: value.controlPointId,
					startTime,
					endTime,
					notes: value.notes || undefined,
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
			if (!nextOpen) {
				form.reset();
				setServerError(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate =
		user && checkPermissions(user, ["control.reservations.create"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button disabled={!canCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					New Reservation
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Create Reservation</DialogTitle>
					<DialogDescription>
						Reserve a control point for a specific time slot.
					</DialogDescription>
				</DialogHeader>
				<form
					id={formId}
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						form.handleSubmit();
					}}
					noValidate
				>
					<form.Field
						name="controlPointId"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Control Point</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={field.handleChange}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a control point" />
										</SelectTrigger>
										<SelectContent>
											{reservablePoints.map((point) => (
												<SelectItem key={point.id} value={point.id}>
													<div className="flex flex-col">
														<span>{point.name}</span>
														{point.location && (
															<span className="text-xs text-muted-foreground">
																{point.location}
															</span>
														)}
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>

					<div className="grid grid-cols-2 gap-4">
						<form.Field
							name="startDate"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Start Date</FieldLabel>
										<Popover
											open={startDatePopoverOpen}
											onOpenChange={setStartDatePopoverOpen}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.state.value && "text-muted-foreground",
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{field.state.value || "Pick a date"}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0">
												<Calendar
													mode="single"
													selected={
														field.state.value
															? new Date(field.state.value)
															: undefined
													}
													onSelect={(date) => {
														if (date) {
															field.handleChange(
																dayjs(date).format("YYYY-MM-DD"),
															);
														}
														setStartDatePopoverOpen(false);
													}}
													disabled={(date) =>
														date < new Date(new Date().setHours(0, 0, 0, 0))
													}
												/>
											</PopoverContent>
										</Popover>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
						<form.Field
							name="startTime"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>Start Time</FieldLabel>
										<Input
											id={field.name}
											type="time"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<form.Field
							name="endDate"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>End Date</FieldLabel>
										<Popover
											open={endDatePopoverOpen}
											onOpenChange={setEndDatePopoverOpen}
										>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.state.value && "text-muted-foreground",
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{field.state.value || "Pick a date"}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0">
												<Calendar
													mode="single"
													selected={
														field.state.value
															? new Date(field.state.value)
															: undefined
													}
													onSelect={(date) => {
														if (date) {
															field.handleChange(
																dayjs(date).format("YYYY-MM-DD"),
															);
														}
														setEndDatePopoverOpen(false);
													}}
													disabled={(date) =>
														date < new Date(new Date().setHours(0, 0, 0, 0))
													}
												/>
											</PopoverContent>
										</Popover>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
						<form.Field
							name="endTime"
							children={(field) => {
								const isInvalid =
									field.state.meta.isTouched && !field.state.meta.isValid;
								return (
									<Field data-invalid={isInvalid}>
										<FieldLabel htmlFor={field.name}>End Time</FieldLabel>
										<Input
											id={field.name}
											type="time"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{isInvalid && (
											<FieldError errors={field.state.meta.errors} />
										)}
									</Field>
								);
							}}
						/>
					</div>

					<form.Field
						name="notes"
						children={(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Notes (optional)</FieldLabel>
								<Textarea
									id={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Add any notes about this reservation..."
									rows={3}
								/>
							</Field>
						)}
					/>

					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}

					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<Button
							type="submit"
							disabled={isSubmitting || !canSubmit || !canCreate}
						>
							{isSubmitting ? <Spinner /> : "Create Reservation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
