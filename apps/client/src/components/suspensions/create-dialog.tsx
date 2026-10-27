import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDownIcon, ChevronsUpDown } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";
import { parseDateTimeInput } from "./datetime";

const formSchema = z.object({
	userId: z.number("User is required"),
	startDate: z.string().min(1, "Start date is required"),
	startTime: z.string().min(1, "Start time is required"),
	endDate: z.string().min(1, "End date is required"),
	endTime: z.string().min(1, "End time is required"),
	internalNotes: z.string().optional(),
	externalNotes: z.string().optional(),
});

type FormValues = {
	userId?: number;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	internalNotes?: string;
	externalNotes?: string;
};

type CreateDialogProps = {
	onUpdate?: () => void;
};

export function SuspensionCreateDialog({
	onUpdate,
}: CreateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [userSearch, setUserSearch] = useState("");
	const [userSelectOpen, setUserSelectOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<{
		id: number;
		name: string;
		username: string;
		email: string;
	} | null>(null);
	const [startDatePopoverOpen, setStartDatePopoverOpen] = useState(false);
	const [endDatePopoverOpen, setEndDatePopoverOpen] = useState(false);
	const queryClient = useQueryClient();
	const formId = useId();

	const { data: usersData } = useQuery({
		queryKey: ["users", "list", userSearch || undefined],
		queryFn: async () => {
			const result = await trpc.users.list.query({
				search: userSearch || undefined,
				limit: 25,
			});
			return result.users;
		},
		enabled: open && userSelectOpen,
	});

	const createMutation = useMutation({
		mutationFn: (input: {
			userId: number;
			startDate: Date;
			endDate: Date;
			internalNotes?: string;
			externalNotes?: string;
		}) => trpc.suspensions.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["suspensions"] });
		},
	});

	const form = useForm({
		defaultValues: {
			userId: undefined,
			startDate: "",
			startTime: "00:00:00",
			endDate: "",
			endTime: "23:59:59",
			internalNotes: "",
			externalNotes: "",
		} as FormValues,
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

				if (value.userId === undefined) {
					setServerError("User is required");
					return;
				}

				await createMutation.mutateAsync({
					userId: value.userId,
					startDate,
					endDate,
					internalNotes: value.internalNotes || undefined,
					externalNotes: value.externalNotes || undefined,
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
				setUserSearch("");
				setUserSelectOpen(false);
				setSelectedUser(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["suspensions.manage"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button disabled={!canCreate}>Create Suspension</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Create Suspension</DialogTitle>
					<DialogDescription>
						Create a new suspension for a user. The user will be notified via
						email when the suspension starts.
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
						name="userId"
						children={(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>User</FieldLabel>
									<Popover
										open={userSelectOpen}
										onOpenChange={setUserSelectOpen}
									>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												role="combobox"
												aria-expanded={userSelectOpen}
												className="w-full justify-between"
											>
												{selectedUser ? (
													<span className="truncate">{selectedUser.name}</span>
												) : (
													"Select a user..."
												)}
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[400px] p-0">
											<Command shouldFilter={false}>
												<CommandInput
													placeholder="Search users..."
													value={userSearch}
													onValueChange={setUserSearch}
												/>
												<CommandList>
													<CommandEmpty>
														{usersData ? "No users found." : "Loading..."}
													</CommandEmpty>
													<CommandGroup>
														{usersData?.map((user) => (
															<CommandItem
																key={user.id}
																value={user.id.toString()}
																onSelect={() => {
																	field.handleChange(user.id);
																	setSelectedUser(user);
																	setUserSelectOpen(false);
																}}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		selectedUser?.id === user.id
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																<div className="flex flex-col">
																	<span className="font-medium">
																		{user.name}
																	</span>
																	<span className="text-xs text-muted-foreground">
																		{user.username} • {user.email}
																	</span>
																</div>
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					/>

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
															startMonth={
																new Date(
																	new Date().setFullYear(
																		new Date().getFullYear() - 1,
																	),
																)
															}
															endMonth={
																new Date(
																	new Date().setFullYear(
																		new Date().getFullYear() + 10,
																	),
																)
															}
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
															startMonth={
																new Date(
																	new Date().setFullYear(
																		new Date().getFullYear() - 1,
																	),
																)
															}
															endMonth={
																new Date(
																	new Date().setFullYear(
																		new Date().getFullYear() + 10,
																	),
																)
															}
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
							disabled={isSubmitting || !canSubmit || !canCreate}
						>
							{isSubmitting ? <Spinner /> : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
