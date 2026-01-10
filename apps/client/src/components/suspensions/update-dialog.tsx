import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, PencilIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkPermissions } from "@/lib/permissions";
import type { Suspension } from "./columns";
import {
	formatDateForInput,
	formatTimeForInput,
	parseDateTimeInput,
} from "./datetime";

const formSchema = z.object({
	startDate: z.string().min(1, "Start date is required"),
	startTime: z.string().min(1, "Start time is required"),
	endDate: z.string().min(1, "End date is required"),
	endTime: z.string().min(1, "End time is required"),
	internalNotes: z.string().optional(),
	externalNotes: z.string().optional(),
});

type UpdateDialogProps = {
	suspension: Suspension;
	onUpdate?: () => void;
};

export function SuspensionUpdateDialog({
	suspension,
	onUpdate,
}: UpdateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
	const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
	const queryClient = useQueryClient();
	const formId = useId();

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			startDate?: Date;
			endDate?: Date;
			internalNotes?: string | null;
			externalNotes?: string | null;
		}) => trpc.suspensions.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["suspensions"] });
		},
	});

	const form = useForm({
		defaultValues: {
			startDate: formatDateForInput(suspension.startDate),
			startTime: formatTimeForInput(suspension.startDate),
			endDate: formatDateForInput(suspension.endDate),
			endTime: formatTimeForInput(suspension.endDate),
			internalNotes: suspension.internalNotes ?? "",
			externalNotes: suspension.externalNotes ?? "",
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const startDate = parseDateTimeInput(value.startDate, value.startTime);
				const endDate = parseDateTimeInput(value.endDate, value.endTime);

				if (!startDate || !endDate) {
					setServerError("Invalid date or time format");
					return;
				}

				if (endDate < startDate) {
					setServerError("End date must be after start date");
					return;
				}

				await updateMutation.mutateAsync({
					id: suspension.id,
					startDate,
					endDate,
					internalNotes: value.internalNotes || null,
					externalNotes: value.externalNotes || null,
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

	const currentUser = useAuth().user;
	const canUpdate =
		currentUser && checkPermissions(currentUser, ["suspensions.manage"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					disabled={!canUpdate}
					aria-label={`Edit suspension for ${suspension.user.username}`}
					title={`Edit suspension for ${suspension.user.username}`}
				>
					<PencilIcon className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Edit Suspension</DialogTitle>
					<DialogDescription>
						Edit suspension for{" "}
						<strong>
							{suspension.user.name} ({suspension.user.username})
						</strong>
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
					<div className="space-y-4">
						<div>
							<FieldLabel className="mb-3">Start Date & Time</FieldLabel>
							<div className="flex gap-4">
								<form.Field
									name="startDate"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										const selectedDate = field.state.value
											? new Date(`${field.state.value}T00:00:00`)
											: undefined;
										return (
											<Field data-invalid={isInvalid} className="flex-1">
												<Popover
													open={startDatePopoverOpen}
													onOpenChange={setStartDatePopoverOpen}
												>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															id={field.name}
															className="w-full justify-between font-normal"
														>
															{selectedDate
																? selectedDate.toLocaleDateString()
																: "Select date"}
															<ChevronDownIcon />
														</Button>
													</PopoverTrigger>
													<PopoverContent
														className="w-auto overflow-hidden p-0"
														align="start"
													>
														<Calendar
															mode="single"
															selected={selectedDate}
															captionLayout="dropdown"
															onSelect={(date) => {
																if (date) {
																	const year = date.getFullYear();
																	const month = String(
																		date.getMonth() + 1,
																	).padStart(2, "0");
																	const day = String(date.getDate()).padStart(
																		2,
																		"0",
																	);
																	field.handleChange(`${year}-${month}-${day}`);
																}
																setStartDatePopoverOpen(false);
															}}
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
											<Field data-invalid={isInvalid} className="flex-1">
												<Input
													type="time"
													id={field.name}
													step="1"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
							</div>
						</div>

						<div>
							<FieldLabel className="mb-3">End Date & Time</FieldLabel>
							<div className="flex gap-4">
								<form.Field
									name="endDate"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										const selectedDate = field.state.value
											? new Date(`${field.state.value}T00:00:00`)
											: undefined;
										return (
											<Field data-invalid={isInvalid} className="flex-1">
												<Popover
													open={endDatePopoverOpen}
													onOpenChange={setEndDatePopoverOpen}
												>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															id={field.name}
															className="w-full justify-between font-normal"
														>
															{selectedDate
																? selectedDate.toLocaleDateString()
																: "Select date"}
															<ChevronDownIcon />
														</Button>
													</PopoverTrigger>
													<PopoverContent
														className="w-auto overflow-hidden p-0"
														align="start"
													>
														<Calendar
															mode="single"
															selected={selectedDate}
															captionLayout="dropdown"
															onSelect={(date) => {
																if (date) {
																	const year = date.getFullYear();
																	const month = String(
																		date.getMonth() + 1,
																	).padStart(2, "0");
																	const day = String(date.getDate()).padStart(
																		2,
																		"0",
																	);
																	field.handleChange(`${year}-${month}-${day}`);
																}
																setEndDatePopoverOpen(false);
															}}
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
											<Field data-invalid={isInvalid} className="flex-1">
												<Input
													type="time"
													id={field.name}
													step="1"
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
							</div>
						</div>
					</div>

					<form.Field
						name="internalNotes"
						children={(field) => {
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>
										Internal Notes{" "}
										<span className="text-muted-foreground">
											(not shared with user)
										</span>
									</FieldLabel>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Add internal notes for staff..."
										rows={3}
									/>
								</Field>
							);
						}}
					/>

					<form.Field
						name="externalNotes"
						children={(field) => {
							return (
								<Field>
									<FieldLabel htmlFor={field.name}>
										External Notes{" "}
										<span className="text-muted-foreground">
											(shared with user in email)
										</span>
									</FieldLabel>
									<Textarea
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Add notes that will be sent to the user..."
										rows={3}
									/>
								</Field>
							);
						}}
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
							disabled={isSubmitting || !canSubmit || !canUpdate}
						>
							{isSubmitting ? <Spinner /> : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
