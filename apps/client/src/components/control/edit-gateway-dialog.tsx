import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
	SheetClose,
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
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	isActive: z.boolean(),
	actions: z.array(
		z.object({
			controlPointId: z.string().uuid(),
			action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
		}),
	),
});

type FormValues = z.infer<typeof formSchema>;

type ControlGateway = {
	id: number;
	name: string;
	description: string | null;
	isActive: boolean;
};

type EditGatewayDialogProps = {
	gateway: ControlGateway;
	onUpdate?: () => void;
};

const ACTION_LABELS: Record<string, string> = {
	TURN_ON: "Turn On",
	TURN_OFF: "Turn Off",
	UNLOCK: "Unlock",
};

export function EditGatewayDialog({
	gateway,
	onUpdate,
}: EditGatewayDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const { data: gatewayDetails } = useQuery({
		queryKey: ["control", "gateways", gateway.id],
		queryFn: async () =>
			await trpc.control.gateways.get.query({ id: gateway.id }),
		enabled: open,
	});

	const { data: pointsData } = useQuery({
		queryKey: ["control", "points", "all"],
		queryFn: async () => await trpc.control.points.list.query({ limit: 100 }),
		enabled: open,
	});

	const controlPoints = pointsData?.points ?? [];

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			name?: string;
			description?: string | null;
			isActive?: boolean;
			actions?: Array<{
				controlPointId: string;
				action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
			}>;
		}) => trpc.control.gateways.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["control", "gateways"],
			});
		},
	});

	const form = useForm<FormValues>({
		defaultValues: {
			name: gateway.name,
			description: gateway.description ?? "",
			isActive: gateway.isActive,
			actions: [],
		},
		validators: { onSubmit: formSchema },
		onSubmit: async ({ value }) => {
			try {
				await updateMutation.mutateAsync({
					id: gateway.id,
					name: value.name,
					description: value.description || null,
					isActive: value.isActive,
					actions: value.actions,
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
			if (nextOpen) {
				const details = gatewayDetails;
				form.reset({
					name: details?.name ?? gateway.name,
					description: details?.description ?? gateway.description ?? "",
					isActive: details?.isActive ?? gateway.isActive,
					actions:
						details?.actions?.map((a) => ({
							controlPointId: a.controlPointId,
							action: a.action as "TURN_ON" | "TURN_OFF" | "UNLOCK",
						})) ?? [],
				});
				setServerError(null);
			}
		},
		[form, gateway, gatewayDetails],
	);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="sm">
					<PencilIcon className="h-4 w-4" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Edit Control Gateway</SheetTitle>
					<SheetDescription>
						Update gateway settings and actions.
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
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="description">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Description</FieldLabel>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									rows={2}
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<div className="border rounded-lg p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="font-medium text-sm">Gateway Actions</h4>
							<form.Field name="actions">
								{(field) => (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											field.handleChange([
												...field.state.value,
												{
													controlPointId: "",
													action: "TURN_ON" as const,
												},
											])
										}
									>
										<PlusIcon className="h-3 w-3 mr-1" />
										Add Action
									</Button>
								)}
							</form.Field>
						</div>

						<form.Field name="actions">
							{(field) => (
								<div className="space-y-2">
									{field.state.value.length === 0 && (
										<p className="text-sm text-muted-foreground text-center py-2">
											No actions configured.
										</p>
									)}
									{field.state.value.map((action, index) => (
										<div
											key={index}
											className="flex items-center gap-2 border rounded-md p-2"
										>
											<Select
												value={action.controlPointId}
												onValueChange={(value) => {
													const updated = [...field.state.value];
													updated[index] = {
														...updated[index],
														controlPointId: value,
													};
													const point = controlPoints.find(
														(p) => p.id === value,
													);
													if (point) {
														if (point.controlClass === "DOOR") {
															updated[index].action = "UNLOCK";
														} else if (updated[index].action === "UNLOCK") {
															updated[index].action = "TURN_ON";
														}
													}
													field.handleChange(updated);
												}}
											>
												<SelectTrigger className="flex-1">
													<SelectValue placeholder="Select control point" />
												</SelectTrigger>
												<SelectContent>
													{controlPoints.map((point) => (
														<SelectItem key={point.id} value={point.id}>
															{point.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											<Select
												value={action.action}
												onValueChange={(value) => {
													const updated = [...field.state.value];
													updated[index] = {
														...updated[index],
														action: value as "TURN_ON" | "TURN_OFF" | "UNLOCK",
													};
													field.handleChange(updated);
												}}
											>
												<SelectTrigger className="w-[130px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{(() => {
														const point = controlPoints.find(
															(p) => p.id === action.controlPointId,
														);
														if (point?.controlClass === "DOOR") {
															return (
																<SelectItem value="UNLOCK">
																	{ACTION_LABELS.UNLOCK}
																</SelectItem>
															);
														}
														return (
															<>
																<SelectItem value="TURN_ON">
																	{ACTION_LABELS.TURN_ON}
																</SelectItem>
																<SelectItem value="TURN_OFF">
																	{ACTION_LABELS.TURN_OFF}
																</SelectItem>
															</>
														);
													})()}
												</SelectContent>
											</Select>

											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => {
													const updated = field.state.value.filter(
														(_, i) => i !== index,
													);
													field.handleChange(updated);
												}}
											>
												<Trash2Icon className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									))}
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="isActive">
						{(field) => (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>
								<label
									htmlFor={field.name}
									className="text-sm font-medium leading-none"
								>
									Active
								</label>
							</div>
						)}
					</form.Field>

					{serverError && (
						<p className="text-destructive text-sm">{serverError}</p>
					)}
				</form>
				<SheetFooter className="mt-4 px-4 sm:px-6">
					<SheetClose asChild>
						<Button variant="outline">Cancel</Button>
					</SheetClose>
					<Button
						form={formId}
						type="submit"
						disabled={isSubmitting || !canSubmit}
					>
						{isSubmitting ? <Spinner className="mr-2" /> : null}
						Save Changes
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
