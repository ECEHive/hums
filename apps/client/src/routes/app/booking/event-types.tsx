import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Loader2Icon,
	PencilIcon,
	Plus,
	RefreshCcwIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import type { AuthUser } from "@/auth";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
import {
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/booking/event-types")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <EventTypesPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = {
	any: ["scheduling.event_types.list"],
} as RequiredPermissions;

type EventTypeRow = {
	id: number;
	name: string;
	description: string | null;
	isActive: boolean;
	durationMinutes: number;
	minSchedulers: number;
	bookingWindowStart: Date | null;
	bookingWindowEnd: Date | null;
	loadBalancing: string;
	schedulerRoles: { id: number; name: string }[];
	participantRoles: { id: number; name: string }[];
	requiredRoles: { id: number; name: string }[];
	_count: { bookings: number };
	createdAt: Date;
	updatedAt: Date;
};

function generateColumns(
	user: AuthUser | null,
	onEdit: (et: EventTypeRow) => void,
	onDelete: (id: number) => void,
): ColumnDef<EventTypeRow>[] {
	const canEdit = checkPermissions(user, ["scheduling.event_types.update"]);
	const canDelete = checkPermissions(user, ["scheduling.event_types.delete"]);

	const columns: ColumnDef<EventTypeRow>[] = [
		{
			accessorKey: "name",
			header: "Name",
		},
		{
			accessorKey: "isActive",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={row.original.isActive ? "default" : "outline"}>
					{row.original.isActive ? "Active" : "Inactive"}
				</Badge>
			),
		},
		{
			accessorKey: "durationMinutes",
			header: "Duration (min)",
		},
		{
			accessorKey: "minSchedulers",
			header: "Min Schedulers",
		},
		{
			accessorKey: "loadBalancing",
			header: "Load Balancing",
			cell: ({ row }) => {
				const map: Record<string, string> = {
					none: "None",
					round_robin: "Round Robin",
					even_distribution: "Even Distribution",
				};
				return map[row.original.loadBalancing] ?? row.original.loadBalancing;
			},
		},
		{
			id: "roles",
			header: "Roles",
			cell: ({ row }) => {
				const roles = [
					...row.original.schedulerRoles.map((r) => ({
						name: r.name,
						type: "S",
					})),
					...row.original.participantRoles.map((r) => ({
						name: r.name,
						type: "P",
					})),
					...row.original.requiredRoles.map((r) => ({
						name: r.name,
						type: "R",
					})),
				];
				if (roles.length === 0) return "—";
				return (
					<div className="flex flex-wrap gap-1">
						{roles.slice(0, 3).map((r, i) => (
							<Badge
								key={`${r.type}-${r.name}-${i}`}
								variant="outline"
								className="text-xs"
							>
								{r.type}: {r.name}
							</Badge>
						))}
						{roles.length > 3 && (
							<Badge variant="outline" className="text-xs">
								+{roles.length - 3}
							</Badge>
						)}
					</div>
				);
			},
		},
		{
			id: "bookingWindow",
			header: "Booking Window",
			cell: ({ row }) => {
				const { bookingWindowStart, bookingWindowEnd } = row.original;
				if (!bookingWindowStart && !bookingWindowEnd) return "—";
				const fmt = (d: Date) =>
					new Date(d).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					});
				if (bookingWindowStart && bookingWindowEnd)
					return `${fmt(bookingWindowStart)} – ${fmt(bookingWindowEnd)}`;
				if (bookingWindowStart) return `From ${fmt(bookingWindowStart)}`;
				return `Until ${fmt(bookingWindowEnd as Date)}`;
			},
		},
		{
			id: "bookings",
			header: "Bookings",
			cell: ({ row }) => row.original._count.bookings,
		},
	];

	if (canEdit || canDelete) {
		columns.push({
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			cell: ({ row }) => (
				<div className="flex items-center justify-end gap-1">
					{canEdit && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onEdit(row.original)}
							aria-label="Edit event type"
						>
							<PencilIcon className="h-4 w-4" />
						</Button>
					)}
					{canDelete && (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onDelete(row.original.id)}
							aria-label="Delete event type"
						>
							<Trash2Icon className="h-4 w-4" />
						</Button>
					)}
				</div>
			),
		});
	}

	return columns;
}

function EventTypesPage() {
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = React.useState(false);
	const [editItem, setEditItem] = React.useState<EventTypeRow | null>(null);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		resetToFirstPage,
	} = useTableState({ persistKey: "scheduling-event-types" });

	const queryParams = React.useMemo(
		() => ({ offset, limit: pageSize }),
		[offset, pageSize],
	);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["scheduling", "eventTypes", queryParams],
		queryFn: () => trpc.instantEventTypes.list.query(queryParams),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => trpc.instantEventTypes.delete.mutate({ id }),
		onSuccess: () => {
			toast.success("Event type deleted");
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "eventTypes"],
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete event type");
		},
	});

	const canCreate = checkPermissions(currentUser, [
		"scheduling.event_types.create",
	]);

	const { totalPages } = usePaginationInfo({
		total: data?.total ?? 0,
		pageSize,
		offset,
		currentCount: data?.eventTypes?.length ?? 0,
	});

	const columns = React.useMemo(
		() =>
			generateColumns(
				currentUser,
				(et) => setEditItem(et),
				(id) => deleteMutation.mutate(id),
			),
		[currentUser, deleteMutation.mutate],
	);

	if (isLoading && !data) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Instant Event Types</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
					{canCreate && (
						<Button onClick={() => setCreateOpen(true)}>
							<Plus className="mr-2 h-4 w-4" /> Add Event Type
						</Button>
					)}
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search event types..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
					</TableToolbar>
					<DataTable
						columns={columns}
						data={data?.eventTypes ?? []}
						isLoading={isLoading}
						emptyMessage="No event types"
						emptyDescription="Create an event type to define booking templates"
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data?.eventTypes?.length ?? 0}
						total={data?.total ?? 0}
						itemName="event types"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>

				<EventTypeSheet
					open={createOpen || editItem !== null}
					onOpenChange={(open) => {
						if (!open) {
							setCreateOpen(false);
							setEditItem(null);
						}
					}}
					eventType={editItem}
				/>
			</PageContent>
		</Page>
	);
}

/** Formats a Date as a local "YYYY-MM-DDTHH:mm" string for datetime-local inputs. */
function toLocalDatetimeString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return `${y}-${m}-${d}T${h}:${min}`;
}

function EventTypeSheet({
	open,
	onOpenChange,
	eventType,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventType: EventTypeRow | null;
}) {
	const queryClient = useQueryClient();
	const isEditing = eventType !== null;

	// Basic fields
	const [name, setName] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [isActive, setIsActive] = React.useState(true);
	const [durationMinutes, setDurationMinutes] = React.useState("30");
	const [minSchedulers, setMinSchedulers] = React.useState("1");
	const [loadBalancing, setLoadBalancing] = React.useState("none");

	// Booking window fields
	const [bookingWindowStart, setBookingWindowStart] = React.useState("");
	const [bookingWindowEnd, setBookingWindowEnd] = React.useState("");

	// Role fields
	const [schedulerRoles, setSchedulerRoles] = React.useState<Role[]>([]);
	const [participantRoles, setParticipantRoles] = React.useState<Role[]>([]);
	const [requiredRoles, setRequiredRoles] = React.useState<Role[]>([]);

	React.useEffect(() => {
		if (eventType) {
			setName(eventType.name);
			setDescription(eventType.description ?? "");
			setIsActive(eventType.isActive);
			setDurationMinutes(eventType.durationMinutes.toString());
			setMinSchedulers(eventType.minSchedulers.toString());
			setLoadBalancing(eventType.loadBalancing);
			setBookingWindowStart(
				eventType.bookingWindowStart
					? toLocalDatetimeString(new Date(eventType.bookingWindowStart))
					: "",
			);
			setBookingWindowEnd(
				eventType.bookingWindowEnd
					? toLocalDatetimeString(new Date(eventType.bookingWindowEnd))
					: "",
			);
			setSchedulerRoles(eventType.schedulerRoles);
			setParticipantRoles(eventType.participantRoles);
			setRequiredRoles(eventType.requiredRoles);
		} else {
			setName("");
			setDescription("");
			setIsActive(true);
			setDurationMinutes("30");
			setMinSchedulers("1");
			setLoadBalancing("none");
			setBookingWindowStart("");
			setBookingWindowEnd("");
			setSchedulerRoles([]);
			setParticipantRoles([]);
			setRequiredRoles([]);
		}
	}, [eventType]);

	const createMutation = useMutation({
		mutationFn: (input: {
			name: string;
			description?: string | null;
			isActive?: boolean;
			durationMinutes: number;
			minSchedulers?: number;
			bookingWindowStart?: Date | null;
			bookingWindowEnd?: Date | null;
			loadBalancing?: "none" | "round_robin" | "even_distribution";
			schedulerRoleIds?: number[];
			participantRoleIds?: number[];
			requiredRoleIds?: number[];
		}) => trpc.instantEventTypes.create.mutate(input),
		onSuccess: () => {
			toast.success("Event type created");
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "eventTypes"],
			});
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create event type");
		},
	});

	const updateMutation = useMutation({
		mutationFn: (input: {
			id: number;
			name?: string;
			description?: string | null;
			isActive?: boolean;
			durationMinutes?: number;
			minSchedulers?: number;
			bookingWindowStart?: Date | null;
			bookingWindowEnd?: Date | null;
			loadBalancing?: "none" | "round_robin" | "even_distribution";
			schedulerRoleIds?: number[];
			participantRoleIds?: number[];
			requiredRoleIds?: number[];
		}) => trpc.instantEventTypes.update.mutate(input),
		onSuccess: () => {
			toast.success("Event type updated");
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "eventTypes"],
			});
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update event type");
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const data = {
			name,
			description: description || null,
			isActive,
			durationMinutes: Number(durationMinutes),
			minSchedulers: Number(minSchedulers),
			bookingWindowStart: bookingWindowStart
				? new Date(bookingWindowStart)
				: null,
			bookingWindowEnd: bookingWindowEnd ? new Date(bookingWindowEnd) : null,
			loadBalancing: loadBalancing as
				| "none"
				| "round_robin"
				| "even_distribution",
			schedulerRoleIds: schedulerRoles.map((r) => r.id),
			participantRoleIds: participantRoles.map((r) => r.id),
			requiredRoleIds: requiredRoles.map((r) => r.id),
		};

		if (isEditing && eventType) {
			updateMutation.mutate({ id: eventType.id, ...data });
		} else {
			createMutation.mutate(data);
		}
	}

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>
						{isEditing ? "Edit Event Type" : "Create Event Type"}
					</SheetTitle>
					<SheetDescription>
						{isEditing
							? "Update the instant event type configuration and rules."
							: "Create a new instant event type with scheduling rules."}
					</SheetDescription>
				</SheetHeader>

				<form onSubmit={handleSubmit} className="space-y-4 p-4">
					{/* Basic Info */}
					<div className="space-y-2">
						<Label htmlFor="etName">Name</Label>
						<Input
							id="etName"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Event type name"
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="etDescription">Description</Label>
						<Textarea
							id="etDescription"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description"
							rows={3}
						/>
					</div>

					<div className="flex items-center gap-2">
						<Checkbox
							id="etIsActive"
							checked={isActive}
							onCheckedChange={(checked) => setIsActive(checked === true)}
						/>
						<Label htmlFor="etIsActive">Active</Label>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="etDuration">Duration (minutes)</Label>
							<Input
								id="etDuration"
								type="number"
								min={5}
								max={480}
								value={durationMinutes}
								onChange={(e) => setDurationMinutes(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="etMinSchedulers">Min Schedulers</Label>
							<Input
								id="etMinSchedulers"
								type="number"
								min={1}
								max={50}
								value={minSchedulers}
								onChange={(e) => setMinSchedulers(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="etLoadBalancing">Load Balancing</Label>
						<Select value={loadBalancing} onValueChange={setLoadBalancing}>
							<SelectTrigger id="etLoadBalancing">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None</SelectItem>
								<SelectItem value="round_robin">Round Robin</SelectItem>
								<SelectItem value="even_distribution">
									Even Distribution
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Booking Window Section */}
					<Separator />
					<h3 className="font-medium text-sm">Booking Window</h3>
					<p className="text-muted-foreground text-xs">
						Restrict when bookings can be scheduled. Leave empty for no
						restriction.
					</p>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="etWindowStart">Start Date/Time</Label>
							<Input
								id="etWindowStart"
								type="datetime-local"
								value={bookingWindowStart}
								onChange={(e) => setBookingWindowStart(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="etWindowEnd">End Date/Time</Label>
							<Input
								id="etWindowEnd"
								type="datetime-local"
								value={bookingWindowEnd}
								onChange={(e) => setBookingWindowEnd(e.target.value)}
							/>
						</div>
					</div>

					{/* Roles Section */}
					<Separator />
					<h3 className="font-medium text-sm">Role Configuration</h3>

					<div className="space-y-1">
						<Label>Scheduler Roles</Label>
						<p className="text-muted-foreground text-xs">
							Users with these roles can be assigned as schedulers.
						</p>
						<RoleMultiSelect
							value={schedulerRoles}
							onChange={setSchedulerRoles}
							placeholder="Select scheduler roles..."
						/>
					</div>

					<div className="space-y-1">
						<Label>Participant Roles</Label>
						<p className="text-muted-foreground text-xs">
							Only users with these roles can book. Leave empty for all.
						</p>
						<RoleMultiSelect
							value={participantRoles}
							onChange={setParticipantRoles}
							placeholder="Select participant roles..."
						/>
					</div>

					<div className="space-y-1">
						<Label>Required Roles</Label>
						<p className="text-muted-foreground text-xs">
							At least one scheduler with each role must be assigned.
						</p>
						<RoleMultiSelect
							value={requiredRoles}
							onChange={setRequiredRoles}
							placeholder="Select required roles..."
						/>
					</div>

					<SheetFooter>
						<Button type="submit" disabled={isPending || !name}>
							{isPending
								? isEditing
									? "Updating..."
									: "Creating..."
								: isEditing
									? "Update"
									: "Create"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
