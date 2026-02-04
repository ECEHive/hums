import { trpc } from "@ecehive/trpc/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { JSX } from "react/jsx-runtime";
import { z } from "zod";
import { useAuth } from "@/auth/AuthProvider";
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
import { checkPermissions } from "@/lib/permissions";

const formSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	providerType: z.enum(["GEORGIA_TECH_PLC"]),
	baseUrl: z.string().url("Must be a valid URL"),
	accessToken: z.string().min(1, "Access token is required"),
	isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type CreateProviderDialogProps = {
	onUpdate?: () => void;
};

export function CreateProviderDialog({
	onUpdate,
}: CreateProviderDialogProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const formId = useId();

	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			providerType: "GEORGIA_TECH_PLC";
			config: Record<string, unknown>;
			isActive?: boolean;
		}) => trpc.control.providers.create.mutate(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "providers"] });
		},
	});

	const form = useForm<FormValues>({
		defaultValues: {
			name: "",
			providerType: "GEORGIA_TECH_PLC",
			baseUrl: "",
			accessToken: "",
			isActive: true,
		},
		validators: {
			onSubmit: formSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				await createMutation.mutateAsync({
					name: value.name,
					providerType: value.providerType,
					config: {
						baseUrl: value.baseUrl,
						accessToken: value.accessToken,
					},
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
				setServerError(null);
			}
		},
		[form],
	);

	const user = useAuth().user;
	const canCreate =
		user && checkPermissions(user, ["control.providers.create"]);

	return (
		<Sheet open={open} onOpenChange={handleDialogChange}>
			<SheetTrigger asChild>
				<Button hidden={!canCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					New Provider
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-full sm:max-w-[600px] overflow-y-auto max-h-full"
			>
				<SheetHeader>
					<SheetTitle>Create Control Provider</SheetTitle>
					<SheetDescription>
						Add a new equipment control provider connection.
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
									placeholder="e.g., Main Building PLC"
								/>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<form.Field name="providerType">
						{(field) => (
							<Field>
								<FieldLabel htmlFor={field.name}>Provider Type</FieldLabel>
								<Select
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as "GEORGIA_TECH_PLC")
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="GEORGIA_TECH_PLC">
											Georgia Tech PLC
										</SelectItem>
									</SelectContent>
								</Select>
								<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
							</Field>
						)}
					</form.Field>

					<div className="border rounded-lg p-4 space-y-4">
						<h4 className="font-medium text-sm">Provider Configuration</h4>

						<form.Field name="baseUrl">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Base URL</FieldLabel>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="https://plc.example.com"
									/>
									<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
								</Field>
							)}
						</form.Field>

						<form.Field name="accessToken">
							{(field) => (
								<Field>
									<FieldLabel htmlFor={field.name}>Access Token</FieldLabel>
									<Input
										id={field.name}
										type="password"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="API key / access token"
									/>
									<FieldError>{field.state.meta.errors.join(", ")}</FieldError>
								</Field>
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
						Create
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
