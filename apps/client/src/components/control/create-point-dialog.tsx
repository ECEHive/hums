import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
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
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().max(1000).optional(),
	location: z.string().max(255).optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]),
	canControlOnline: z.boolean(),
	canControlWithCode: z.boolean(),
	providerId: z.number().int().positive("Provider is required"),
	tagName: z.string().min(1, "Tag name is required"),
	ipAddress: z.ipv4({ message: "Invalid IPv4 address" }),
	isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type CreateControlPointDialogProps = {
	onUpdate?: () => void;
};

export function CreateControlPointDialog({
	onUpdate,
}: CreateControlPointDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [authorizedRoles, setAuthorizedRoles] = useState<Role[]>([]);
	const queryClient = useQueryClient();
	const formId = useId();

	const { data: providersData } = useQuery({
		queryKey: ["control", "providers", "all"],
		queryFn: async () =>
			await trpc.control.providers.list.query({ limit: 100, isActive: true }),
		enabled: open,
	});

	const providers = providersData?.providers ?? [];

	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			description?: string;
			location?: string;
			controlClass: "SWITCH" | "DOOR";
			canControlOnline: boolean;
			canControlWithCode: boolean;
			providerId: number;
			providerConfig: Record<string, unknown>;
			authorizedRoleIds?: number[];
			isActive: boolean;
		}) => trpc.control.points.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "points"] });
		},
	});

	const form = useForm<FormValues>({
		defaultValues: {
			name: "",
			description: "",
			location: "",
			controlClass: "SWITCH",
			canControlOnline: true,
			canControlWithCode: false,
			providerId: 0,
			tagName: "",
			ipAddress: "",
			isActive: true,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await createMutation.mutateAsync({
					name: value.name,
					description: value.description || undefined,
					location: value.location || undefined,
					controlClass: value.controlClass,
					canControlOnline: value.canControlOnline,
					canControlWithCode: value.canControlWithCode,
					providerId: value.providerId,
					providerConfig: {
						tagName: value.tagName,
						ipAddress: value.ipAddress,
					},
					authorizedRoleIds: authorizedRoles.map((r) => r.id),
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
				form.reset();
				setAuthorizedRoles([]);
				setServerError(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate = user && checkPermissions(user, ["control.points.create"]);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button hidden={!canCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					New Control Point
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Create Control Point</SheetTitle>
					<SheetDescription>
						Add a new equipment control point.
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
									placeholder="e.g., Laser Cutter"
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
									placeholder="Optional description"
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
									placeholder="e.g., Room 101"
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
										<SelectValue placeholder="Select type" />
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
										<SelectValue placeholder="Select provider" />
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
										placeholder="PLC tag name"
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
										placeholder="e.g., 192.168.1.100"
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
									Can control online
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
						Create
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
