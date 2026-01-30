import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlarmClockIcon,
	AlertTriangleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EditIcon,
	EyeIcon,
	GripVerticalIcon,
	LaptopMinimalIcon,
	type LucideIcon,
	MessageSquareHeartIcon,
	MessageSquareWarningIcon,
	PlusIcon,
	SaveIcon,
	SettingsIcon,
	ShoppingBasketIcon,
	ShoppingCartIcon,
	TagIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import {
	FieldBuilder,
	type TicketField,
} from "@/components/tickets/field-builder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { RequiredPermissions } from "@/lib/permissions";

/**
 * Available icons for ticket types
 */
const TICKET_TYPE_ICONS: Record<string, LucideIcon> = {
	"alarm-clock": AlarmClockIcon,
	"laptop-minimal": LaptopMinimalIcon,
	"shopping-basket": ShoppingBasketIcon,
	"shopping-cart": ShoppingCartIcon,
	"message-square-warning": MessageSquareWarningIcon,
	"message-square-heart": MessageSquareHeartIcon,
	tag: TagIcon,
};

const ICON_OPTIONS = [
	{ value: "tag", label: "Tag" },
	{ value: "alarm-clock", label: "Alarm Clock" },
	{ value: "laptop-minimal", label: "Laptop" },
	{ value: "shopping-basket", label: "Shopping Basket" },
	{ value: "shopping-cart", label: "Shopping Cart" },
	{ value: "message-square-warning", label: "Warning Message" },
	{ value: "message-square-heart", label: "Heart Message" },
] as const;

function getTicketTypeIcon(iconName: string | null): LucideIcon {
	if (!iconName) return TagIcon;
	return TICKET_TYPE_ICONS[iconName] ?? TagIcon;
}

export const Route = createFileRoute("/app/tickets/admin/types")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <TicketTypesManagementPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["tickets.types.manage"] as RequiredPermissions;

interface TicketType {
	id: number;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	requiresAuth: boolean;
	isActive: boolean;
	sortOrder: number;
	fieldSchema: { fields: TicketField[] } | null;
	createdAt: Date;
	updatedAt: Date;
}

interface SortableTicketTypeCardProps {
	ticketType: TicketType;
	onEdit: (ticketType: TicketType) => void;
	onDelete: (ticketType: TicketType) => void;
}

function SortableTicketTypeCard({
	ticketType,
	onEdit,
	onDelete,
}: SortableTicketTypeCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: ticketType.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const Icon = getTicketTypeIcon(ticketType.icon);

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={`${!ticketType.isActive ? "opacity-60" : ""} ${isDragging ? "z-50 shadow-lg" : ""}`}
		>
			<CardContent className="py-2 px-4">
				<div className="flex items-center gap-4">
					<div
						className="text-muted-foreground cursor-grab touch-none"
						{...attributes}
						{...listeners}
					>
						<GripVerticalIcon className="h-5 w-5" />
					</div>

					<div
						className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
						style={{
							backgroundColor: ticketType.color
								? `${ticketType.color}20`
								: "hsl(var(--muted))",
						}}
					>
						<Icon
							className="h-5 w-5"
							style={{
								color: ticketType.color ?? undefined,
							}}
						/>
					</div>

					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="font-medium">{ticketType.name}</span>
							{!ticketType.isActive && (
								<Badge variant="secondary">Inactive</Badge>
							)}
							{ticketType.requiresAuth && (
								<Badge variant="outline">Auth Required</Badge>
							)}
							{ticketType.fieldSchema &&
								Array.isArray(
									(ticketType.fieldSchema as { fields?: unknown[] }).fields,
								) &&
								(ticketType.fieldSchema as { fields: unknown[] }).fields
									.length > 0 && (
									<Badge variant="outline" className="text-xs">
										{
											(ticketType.fieldSchema as { fields: unknown[] }).fields
												.length
										}{" "}
										fields
									</Badge>
								)}
						</div>
						{ticketType.description && (
							<p className="text-sm text-muted-foreground truncate">
								{ticketType.description}
							</p>
						)}
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<Link
							to="/submit/$ticketTypeId"
							params={{ ticketTypeId: String(ticketType.id) }}
							target="_blank"
						>
							<Button variant="ghost" size="icon" title="Preview form">
								<EyeIcon className="h-4 w-4" />
							</Button>
						</Link>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onEdit(ticketType)}
						>
							<EditIcon className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onDelete(ticketType)}
						>
							<Trash2Icon className="h-4 w-4 text-destructive" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function TicketTypesManagementPage() {
	const queryClient = useQueryClient();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editingType, setEditingType] = useState<TicketType | null>(null);
	const [deletingType, setDeletingType] = useState<TicketType | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const {
		data: ticketTypes,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["ticket-types-all"],
		queryFn: async () => {
			return await trpc.tickets.types.list.query({ activeOnly: false });
		},
	});

	const reorderMutation = useMutation({
		mutationFn: async (orderedIds: number[]) => {
			return await trpc.tickets.types.reorder.mutate({ orderedIds });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["ticket-types-all"] });
		},
		onError: (error) => {
			toast.error(`Failed to reorder ticket types: ${error.message}`);
			queryClient.invalidateQueries({ queryKey: ["ticket-types-all"] });
		},
	});

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id && ticketTypes) {
			const oldIndex = ticketTypes.findIndex((t) => t.id === active.id);
			const newIndex = ticketTypes.findIndex((t) => t.id === over.id);

			const newOrder = arrayMove(ticketTypes, oldIndex, newIndex);
			const orderedIds = newOrder.map((t) => t.id);

			// Optimistically update the cache
			queryClient.setQueryData(["ticket-types-all"], newOrder);

			// Persist to server
			reorderMutation.mutate(orderedIds);
		}
	};

	const deleteMutation = useMutation({
		mutationFn: async (id: number) => {
			return await trpc.tickets.types.delete.mutate({ id });
		},
		onSuccess: () => {
			toast.success("Ticket type deleted successfully");
			setDeletingType(null);
			queryClient.invalidateQueries({ queryKey: ["ticket-types-all"] });
		},
		onError: (error) => {
			toast.error(`Failed to delete ticket type: ${error.message}`);
		},
	});

	if (isLoading) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Ticket Types</PageTitle>
				</PageHeader>
				<PageContent>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-24" />
						))}
					</div>
				</PageContent>
			</Page>
		);
	}

	if (error) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Ticket Types</PageTitle>
				</PageHeader>
				<PageContent>
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Failed to load ticket types. Please try again later.
						</AlertDescription>
					</Alert>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Ticket Types</PageTitle>
				<PageActions>
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<PlusIcon className="h-4 w-4 mr-2" />
						Add Ticket Type
					</Button>
				</PageActions>
			</PageHeader>

			<PageContent>
				{ticketTypes?.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<TagIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
							<h3 className="text-lg font-medium mb-2">No Ticket Types</h3>
							<p className="text-muted-foreground mb-4">
								Create your first ticket type to start receiving tickets.
							</p>
							<Button onClick={() => setIsCreateDialogOpen(true)}>
								<PlusIcon className="h-4 w-4 mr-2" />
								Create Ticket Type
							</Button>
						</CardContent>
					</Card>
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<SortableContext
							items={ticketTypes?.map((t) => t.id) ?? []}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-3">
								{ticketTypes?.map((ticketType) => (
									<SortableTicketTypeCard
										key={ticketType.id}
										ticketType={ticketType as TicketType}
										onEdit={(t) => setEditingType(t)}
										onDelete={(t) => setDeletingType(t)}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				)}
			</PageContent>

			{/* Create Sheet */}
			<TicketTypeSheet
				mode="create"
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
			/>

			{/* Edit Sheet */}
			<TicketTypeSheet
				mode="edit"
				ticketType={editingType}
				open={!!editingType}
				onOpenChange={(open) => !open && setEditingType(null)}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={!!deletingType}
				onOpenChange={(open) => !open && setDeletingType(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Ticket Type</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the ticket type "
							{deletingType?.name}"? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Warning</AlertTitle>
						<AlertDescription>
							If there are any tickets using this type, deletion will fail.
							Consider deactivating the type instead.
						</AlertDescription>
					</Alert>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingType(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() =>
								deletingType && deleteMutation.mutate(deletingType.id)
							}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Page>
	);
}

interface TicketTypeSheetProps {
	mode: "create" | "edit";
	ticketType?: TicketType | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function TicketTypeSheet({
	mode,
	ticketType,
	open,
	onOpenChange,
}: TicketTypeSheetProps) {
	const queryClient = useQueryClient();
	const formId = useId();
	const [serverError, setServerError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<string>("settings");

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [icon, setIcon] = useState("tag");
	const [color, setColor] = useState("");
	const [requiresAuth, setRequiresAuth] = useState(false);
	const [isActive, setIsActive] = useState(true);
	const [fields, setFields] = useState<TicketField[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Validation errors
	const [nameError, setNameError] = useState<string | null>(null);
	const [colorError, setColorError] = useState<string | null>(null);

	// Reset form when dialog opens/closes or ticket type changes
	const resetForm = useCallback(() => {
		if (mode === "edit" && ticketType) {
			setName(ticketType.name);
			setDescription(ticketType.description ?? "");
			setIcon(ticketType.icon ?? "tag");
			setColor(ticketType.color ?? "");
			setRequiresAuth(ticketType.requiresAuth);
			setIsActive(ticketType.isActive);
			setFields(ticketType.fieldSchema?.fields ?? []);
		} else {
			setName("");
			setDescription("");
			setIcon("tag");
			setColor("");
			setRequiresAuth(false);
			setIsActive(true);
			setFields([]);
		}
		setServerError(null);
		setNameError(null);
		setColorError(null);
		setActiveTab("settings");
	}, [mode, ticketType]);

	// Reset form when sheet opens or ticketType changes
	useEffect(() => {
		if (open) {
			resetForm();
		}
	}, [open, ticketType, resetForm]);

	// Handle sheet close
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
		},
		[onOpenChange],
	);

	// Create mutation
	const createMutation = useMutation({
		mutationFn: async (data: {
			name: string;
			description?: string;
			icon?: string;
			color?: string;
			requiresAuth: boolean;
			isActive: boolean;
			fieldSchema?: { fields: TicketField[] };
		}) => {
			// biome-ignore lint/suspicious/noExplicitAny: freeform input
			return await trpc.tickets.types.create.mutate(data as any);
		},
		onSuccess: () => {
			toast.success("Ticket type created successfully");
			onOpenChange(false);
			queryClient.invalidateQueries({ queryKey: ["ticket-types-all"] });
		},
		onError: (error) => {
			setServerError(error.message);
		},
	});

	// Update mutation
	const updateMutation = useMutation({
		mutationFn: async (data: {
			id: number;
			name?: string;
			description?: string | null;
			icon?: string | null;
			color?: string | null;
			requiresAuth?: boolean;
			isActive?: boolean;
			fieldSchema?: { fields: TicketField[] } | null;
		}) => {
			// biome-ignore lint/suspicious/noExplicitAny: freeform input
			return await trpc.tickets.types.update.mutate(data as any);
		},
		onSuccess: () => {
			toast.success("Ticket type updated successfully");
			onOpenChange(false);
			queryClient.invalidateQueries({ queryKey: ["ticket-types-all"] });
		},
		onError: (error) => {
			setServerError(error.message);
		},
	});

	// Validate form
	const validate = (): boolean => {
		let isValid = true;
		setServerError(null);

		// Validate name
		if (!name.trim()) {
			setNameError("Name is required");
			isValid = false;
		} else if (name.length > 100) {
			setNameError("Name must be 100 characters or less");
			isValid = false;
		} else {
			setNameError(null);
		}

		// Validate color
		if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
			setColorError("Must be a valid hex color (e.g., #FF5733)");
			isValid = false;
		} else {
			setColorError(null);
		}

		// Validate fields
		for (const field of fields) {
			if (!field.id.trim()) {
				setServerError("All fields must have an ID");
				isValid = false;
				break;
			}
			if (!field.label.trim()) {
				setServerError("All fields must have a label");
				isValid = false;
				break;
			}
			if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.id)) {
				setServerError(
					`Field ID "${field.id}" must start with a letter and contain only letters, numbers, and underscores`,
				);
				isValid = false;
				break;
			}
		}

		// Check for duplicate field IDs
		const fieldIds = fields.map((f) => f.id);
		const uniqueIds = new Set(fieldIds);
		if (uniqueIds.size !== fieldIds.length) {
			setServerError("Duplicate field IDs are not allowed");
			isValid = false;
		}

		return isValid;
	};

	// Handle submit
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setServerError(null);

		if (!validate()) {
			return;
		}

		setIsSubmitting(true);

		try {
			if (mode === "create") {
				await createMutation.mutateAsync({
					name: name.trim(),
					description: description.trim() || undefined,
					icon: icon || undefined,
					color: color.trim() || undefined,
					requiresAuth,
					isActive,
					fieldSchema: fields.length > 0 ? { fields } : undefined,
				});
			} else if (ticketType) {
				await updateMutation.mutateAsync({
					id: ticketType.id,
					name: name.trim(),
					description: description.trim() || null,
					icon: icon || null,
					color: color.trim() || null,
					requiresAuth,
					isActive,
					fieldSchema: fields.length > 0 ? { fields } : null,
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent
				side="right"
				className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
			>
				<SheetHeader>
					<SheetTitle>
						{mode === "create" ? "Create Ticket Type" : "Edit Ticket Type"}
					</SheetTitle>
					<SheetDescription>
						{mode === "create"
							? "Create a new ticket type with custom fields for users to submit."
							: "Modify the ticket type settings and form fields."}
					</SheetDescription>
				</SheetHeader>

				<form
					id={formId}
					onSubmit={handleSubmit}
					className="flex-1 overflow-hidden px-4"
				>
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="h-full flex flex-col"
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="settings" className="flex items-center gap-2">
								<SettingsIcon className="h-4 w-4" />
								Settings
							</TabsTrigger>
							<TabsTrigger value="fields" className="flex items-center gap-2">
								<TagIcon className="h-4 w-4" />
								Form Fields
								{fields.length > 0 && (
									<Badge variant="secondary" className="ml-1">
										{fields.length}
									</Badge>
								)}
							</TabsTrigger>
						</TabsList>

						<div className="flex-1 overflow-y-auto mt-4 px-1">
							<TabsContent value="settings" className="mt-0 space-y-4">
								<Field>
									<FieldLabel>Name</FieldLabel>
									<Input
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="Inventory Request"
									/>
									<FieldDescription>
										The display name for this ticket type.
									</FieldDescription>
									{nameError && <FieldError>{nameError}</FieldError>}
								</Field>

								<Field>
									<FieldLabel>Description</FieldLabel>
									<Textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Request new items for the makerspace inventory..."
										rows={2}
									/>
								</Field>

								<div className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel>Icon</FieldLabel>
										<div className="flex flex-wrap gap-2">
											{ICON_OPTIONS.map((option) => {
												const IconComponent = TICKET_TYPE_ICONS[option.value];
												const isSelected = icon === option.value;
												return (
													<button
														key={option.value}
														type="button"
														onClick={() => setIcon(option.value)}
														className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors ${
															isSelected
																? "border-primary bg-primary/10"
																: "border-muted hover:border-muted-foreground/50"
														}`}
														title={option.label}
													>
														<IconComponent
															className="h-5 w-5"
															style={{
																color:
																	color && /^#[0-9A-Fa-f]{6}$/.test(color)
																		? color
																		: undefined,
															}}
														/>
													</button>
												);
											})}
										</div>
									</Field>

									<Field>
										<FieldLabel>Color</FieldLabel>
										<div className="flex gap-2">
											<Input
												value={color}
												onChange={(e) => setColor(e.target.value)}
												placeholder="#FF5733"
											/>
											{color && /^#[0-9A-Fa-f]{6}$/.test(color) && (
												<div
													className="w-10 h-10 rounded-md border shrink-0"
													style={{ backgroundColor: color }}
												/>
											)}
										</div>
										{colorError && <FieldError>{colorError}</FieldError>}
									</Field>
								</div>

								<div className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-3">
									<Checkbox
										id="requiresAuth"
										checked={requiresAuth}
										onCheckedChange={(checked) => setRequiresAuth(!!checked)}
									/>
									<div className="space-y-1 leading-none">
										<label
											htmlFor="requiresAuth"
											className="text-sm font-medium cursor-pointer"
										>
											Requires Authentication
										</label>
										<p className="text-sm text-muted-foreground">
											Users must be logged in to submit this ticket type.
										</p>
									</div>
								</div>

								<div className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-3">
									<Checkbox
										id="isActive"
										checked={isActive}
										onCheckedChange={(checked) => setIsActive(!!checked)}
									/>
									<div className="space-y-1 leading-none">
										<label
											htmlFor="isActive"
											className="text-sm font-medium cursor-pointer"
										>
											Active
										</label>
										<p className="text-sm text-muted-foreground">
											Inactive ticket types won't be shown to users.
										</p>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="fields" className="mt-0">
								<FieldBuilder fields={fields} onChange={setFields} />
							</TabsContent>
						</div>
					</Tabs>

					{serverError && (
						<Alert variant="destructive" className="mt-4">
							<AlertTriangleIcon className="h-4 w-4" />
							<AlertDescription>{serverError}</AlertDescription>
						</Alert>
					)}
				</form>

				<SheetFooter className="mt-4 flex-row justify-between border-t pt-4">
					<div className="flex items-center gap-2">
						{activeTab === "fields" && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setActiveTab("settings")}
							>
								<ChevronLeftIcon className="h-4 w-4 mr-1" />
								Settings
							</Button>
						)}
						{activeTab === "settings" && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setActiveTab("fields")}
							>
								Form Fields
								<ChevronRightIcon className="h-4 w-4 ml-1" />
							</Button>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" form={formId} disabled={isSubmitting}>
							{isSubmitting ? (
								"Saving..."
							) : (
								<>
									<SaveIcon className="h-4 w-4 mr-2" />
									{mode === "create" ? "Create" : "Save Changes"}
								</>
							)}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
