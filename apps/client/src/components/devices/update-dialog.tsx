import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
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

type Device = {
	id: number;
	name: string;
	ipAddress: string;
	isActive: boolean;
	hasKioskAccess: boolean;
	hasDashboardAccess: boolean;
	hasInventoryAccess: boolean;
};

type UpdateDialogProps = {
	device: Device;
};

export function UpdateDialog({ device }: UpdateDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const formSchema = z.object({
		name: z.string().min(1, "Name is required").max(100),
		ipAddress: z
			.string()
			.regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, "Must be a valid IP address"),
		isActive: z.boolean(),
		hasKioskAccess: z.boolean(),
		hasDashboardAccess: z.boolean(),
		hasInventoryAccess: z.boolean(),
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			name: string;
			ipAddress: string;
			isActive: boolean;
			hasKioskAccess: boolean;
			hasDashboardAccess: boolean;
			hasInventoryAccess: boolean;
		}) => trpc.devices.update.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["devices"] });
		},
	});

	const form = useForm({
		defaultValues: {
			name: device.name,
			ipAddress: device.ipAddress,
			isActive: device.isActive,
			hasKioskAccess: device.hasKioskAccess,
			hasDashboardAccess: device.hasDashboardAccess,
			hasInventoryAccess: device.hasInventoryAccess,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await updateMutation.mutateAsync({ id: device.id, ...value });
				setOpen(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setServerError(message);
			}
		},
	});

	const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
	const canSubmit = useStore(form.store, (s) => s.canSubmit);

	const handleDialogChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen);
			if (!nextOpen) {
				// reset to the form's initial defaults when closing
				form.reset();
				setServerError(null);
			}
		},
		[form, device],
	);

	const user = useAuth().user;
	const canUpdate = user && checkPermissions(user, ["devices.update"]);

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" disabled={!canUpdate}>
					<Pencil className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Update Device</DialogTitle>
					<DialogDescription>
						Edit device details and access permissions.
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
								<FieldLabel>Name</FieldLabel>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="e.g., Front Desk Device"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="ipAddress">
						{(field) => (
							<Field>
								<FieldLabel>IP Address</FieldLabel>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="e.g., 192.168.1.100"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="isActive">
						{(field) => (
							<Field>
								<div className="flex items-center space-x-2">
									<Checkbox
										checked={field.state.value}
										onCheckedChange={(checked: boolean) =>
											field.handleChange(checked)
										}
									/>
									<FieldLabel className="!mt-0">Active</FieldLabel>
								</div>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<div className="border-t pt-4 space-y-4">
						<h4 className="text-sm font-medium">Access Permissions</h4>

						<form.Field name="hasKioskAccess">
							{(field) => (
								<Field>
									<div className="flex items-center space-x-2">
										<Checkbox
											checked={field.state.value}
											onCheckedChange={(checked: boolean) =>
												field.handleChange(checked)
											}
										/>
										<FieldLabel className="!mt-0">Kiosk Access</FieldLabel>
									</div>
									<p className="text-xs text-muted-foreground ml-6">
										Allow this device to function as a tap-in/out kiosk
									</p>
									<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
								</Field>
							)}
						</form.Field>

					<form.Field name="hasDashboardAccess">
						{(field) => (
							<Field>
								<div className="flex items-center space-x-2">
									<Checkbox
										checked={field.state.value}
										onCheckedChange={(checked: boolean) =>
											field.handleChange(checked)
										}
									/>
									<FieldLabel className="!mt-0">Dashboard Access</FieldLabel>
								</div>
								<p className="text-xs text-muted-foreground ml-6">
									Allow this device to view staffing information on the
									dashboard
								</p>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="hasInventoryAccess">
						{(field) => (
							<Field>
								<div className="flex items-center space-x-2">
									<Checkbox
										checked={field.state.value}
										onCheckedChange={(checked: boolean) =>
											field.handleChange(checked)
										}
									/>
									<FieldLabel className="!mt-0">Inventory Access</FieldLabel>
								</div>
								<p className="text-xs text-muted-foreground ml-6">
									Allow this device to access the inventory kiosk for
									check-in/check-out
								</p>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>
				</div>					{serverError && (
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
						{isSubmitting ? <Spinner /> : "Update"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
