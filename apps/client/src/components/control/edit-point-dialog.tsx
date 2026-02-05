import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
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
	description: z.string().max(1000).optional().nullable(),
	location: z.string().max(255).optional().nullable(),
	controlClass: z.enum(["SWITCH", "DOOR"]),
	canControlOnline: z.boolean(),
	canControlWithCode: z.boolean(),
	providerId: z.number().int().positive("Provider is required"),
	tagName: z.string().min(1, "Tag name is required"),
	ipAddress: z.ipv4({ message: "Invalid IPv4 address" }),
	autoTurnOffEnabled: z.boolean(),
	autoTurnOffMinutes: z.number().int().min(1).optional().nullable(),
	isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type ControlPoint = {
	id: string;
	name: string;
	description: string | null;
	location: string | null;
	controlClass: "SWITCH" | "DOOR";
	canControlOnline: boolean;
	canControlWithCode: boolean;
	currentState: boolean;
	isActive: boolean;
	autoTurnOffEnabled: boolean;
	autoTurnOffMinutes: number | null;
	provider: {
		id: number;
		name: string;
		providerType: string;
	};
	authorizedRoles: { id: number; name: string }[];
	authorizedUsers: { id: number; name: string; username: string }[];
	providerConfig?: {
		tagName?: string;
		ipAddress?: string;
	};
};

type EditControlPointDialogProps = {
	point: ControlPoint;
	onUpdate?: () => void;
};

export function EditControlPointDialog({
	point,
	onUpdate,
}: EditControlPointDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [authorizedRoles, setAuthorizedRoles] = useState<Role[]>(
		point.authorizedRoles ?? [],
	);
	const queryClient = useQueryClient();
	const formId = useId();

	// Fetch full point details when dialog opens
	const { data: pointDetails } = useQuery({
		queryKey: ["control", "points", point.id],
		queryFn: async () => await trpc.control.points.get.query({ id: point.id }),
		enabled: open,
	});

	const { data: providersData } = useQuery({
		queryKey: ["control", "providers", "all"],
		queryFn: async () =>
			await trpc.control.providers.list.query({ limit: 100, isActive: true }),
		enabled: open,
	});

	const providers = providersData?.providers ?? [];

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: string;
			name?: string;
			description?: string | null;
			location?: string | null;
			controlClass?: "SWITCH" | "DOOR";
			canControlOnline?: boolean;
			canControlWithCode?: boolean;
			providerId?: number;
			providerConfig?: Record<string, unknown>;
			authorizedRoleIds?: number[];
			autoTurnOffEnabled?: boolean;
			autoTurnOffMinutes?: number | null;
			isActive?: boolean;
		}) => trpc.control.points.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "points"] });
		},
	});

	// Extract provider config
	const config = (pointDetails?.providerConfig ??
		point.providerConfig ??
		{}) as {
		tagName?: string;
		ipAddress?: string;
	};

	const form = useForm<FormValues>({
		defaultValues: {
			name: point.name,
			description: point.description,
			location: point.location,
			controlClass: point.controlClass,
			canControlOnline: point.canControlOnline,
			canControlWithCode: point.canControlWithCode,
			providerId: point.provider.id,
			tagName: config.tagName ?? "",
			ipAddress: config.ipAddress ?? "",
			autoTurnOffEnabled: point.autoTurnOffEnabled ?? false,
			autoTurnOffMinutes: point.autoTurnOffMinutes ?? null,
			isActive: point.isActive,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateMutation.mutateAsync({
					id: point.id,
					name: value.name,
					description: value.description,
					location: value.location,
					controlClass: value.controlClass,
					canControlOnline: value.canControlOnline,
					canControlWithCode: value.canControlWithCode,
					providerId: value.providerId,
					providerConfig: {
						tagName: value.tagName,
						ipAddress: value.ipAddress,
					},
					authorizedRoleIds: authorizedRoles.map((r) => r.id),
					autoTurnOffEnabled: value.autoTurnOffEnabled,
					autoTurnOffMinutes: value.autoTurnOffEnabled
						? value.autoTurnOffMinutes
						: null,
					isActive: value.isActive,
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
				const cfg = (pointDetails?.providerConfig ??
					point.providerConfig ??
					{}) as {
					tagName?: string;
					ipAddress?: string;
				};
				form.reset({
					name: pointDetails?.name ?? point.name,
					description: pointDetails?.description ?? point.description,
					location: pointDetails?.location ?? point.location,
					controlClass: pointDetails?.controlClass ?? point.controlClass,
					canControlOnline:
						pointDetails?.canControlOnline ?? point.canControlOnline,
					canControlWithCode:
						pointDetails?.canControlWithCode ?? point.canControlWithCode,
					providerId: pointDetails?.provider?.id ?? point.provider.id,
					tagName: cfg.tagName ?? "",
					ipAddress: cfg.ipAddress ?? "",
					autoTurnOffEnabled:
						pointDetails?.autoTurnOffEnabled ??
						point.autoTurnOffEnabled ??
						false,
					autoTurnOffMinutes:
						pointDetails?.autoTurnOffMinutes ??
						point.autoTurnOffMinutes ??
						null,
					isActive: pointDetails?.isActive ?? point.isActive,
				});
				setAuthorizedRoles(
					pointDetails?.authorizedRoles ?? point.authorizedRoles ?? [],
				);
				setServerError(null);
			}
		},
		[form, point, pointDetails],
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
					<SheetTitle>Edit Control Point</SheetTitle>
					<SheetDescription>Update control point settings.</SheetDescription>
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
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									rows={2}
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="location">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Location</FieldLabel>
								<Input
									id={field.name}
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="controlClass">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Control Type</FieldLabel>
								<Select
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as "SWITCH" | "DOOR")
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="SWITCH">
											Switch (On/Off toggle)
										</SelectItem>
										<SelectItem value="DOOR">
											Door (Momentary unlock)
										</SelectItem>
									</SelectContent>
								</Select>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="providerId">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Provider</FieldLabel>
								<Select
									value={field.state.value?.toString() ?? ""}
									onValueChange={(value) => field.handleChange(Number(value))}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{providers.map((provider) => (
											<SelectItem
												key={provider.id}
												value={provider.id.toString()}
											>
												{provider.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<div className="border rounded-lg p-4 space-y-4">
						<h4 className="font-medium text-sm">Provider Configuration</h4>

						<form.Field name="tagName">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Tag Name</FieldLabel>
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

						<form.Field name="ipAddress">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>IP Address</FieldLabel>
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
					</div>

					<Field>
						<FieldLabel>Authorized Roles</FieldLabel>
						<RoleMultiSelect
							value={authorizedRoles}
							onChange={setAuthorizedRoles}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Leave empty to allow anyone with operate permission
						</p>
					</Field>

					<form.Field name="canControlOnline">
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
									Can control online (via web portal)
								</label>
							</div>
						)}
					</form.Field>

					<form.Field name="canControlWithCode">
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
									Can control with QR code URL
								</label>
							</div>
						)}
					</form.Field>

					<div className="border rounded-lg p-4 space-y-4">
						<h4 className="font-medium text-sm">Auto Turn-Off Settings</h4>
						<p className="text-xs text-muted-foreground">
							When enabled, this control point will automatically turn off after
							the specified duration if left on.
						</p>

						<form.Field name="autoTurnOffEnabled">
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
										Enable auto turn-off
									</label>
								</div>
							)}
						</form.Field>

						<form.Field name="autoTurnOffMinutes">
							{(field) => (
								<form.Subscribe
									selector={(state) => state.values.autoTurnOffEnabled}
								>
									{(autoTurnOffEnabled) => (
										<Field>
											<FieldLabel htmlFor={field.name}>
												Auto turn-off after (minutes)
											</FieldLabel>
											<Input
												id={field.name}
												type="number"
												min={1}
												value={field.state.value ?? ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? Number(e.target.value) : null,
													)
												}
												onBlur={field.handleBlur}
												disabled={!autoTurnOffEnabled}
												placeholder="Enter minutes"
											/>
											<FieldError>
												{field.state.meta.errors.join(", ")}
											</FieldError>
										</Field>
									)}
								</form.Subscribe>
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
