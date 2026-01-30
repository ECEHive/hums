import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	CheckCircleIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	ClockIcon,
	PackageIcon,
	SaveIcon,
	TagIcon,
	UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { DynamicTicketDetails, type TicketField } from "@/components/tickets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAdminTicketsMemory } from "@/hooks/use-admin-tickets-memory";
import type { RequiredPermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tickets/admin/$ticketId")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AdminTicketDetailPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["tickets.manage"] as RequiredPermissions;

const ticketTypeIcons: Record<
	string,
	React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
	"inventory-request": PackageIcon,
	concern: AlertTriangleIcon,
	default: TagIcon,
};

const statusStyles: Record<
	string,
	{
		variant: "default" | "secondary" | "destructive" | "outline";
		label: string;
	}
> = {
	pending: { variant: "secondary", label: "Pending" },
	in_progress: { variant: "default", label: "In Progress" },
	resolved: { variant: "outline", label: "Resolved" },
	closed: { variant: "outline", label: "Closed" },
	cancelled: { variant: "destructive", label: "Cancelled" },
};

function AdminTicketDetailPage() {
	const { ticketId } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Remember this ticket visit for navigation
	useAdminTicketsMemory(ticketId);

	const [selectedStatus, setSelectedStatus] = useState<string>("");
	const [selectedHandler, setSelectedHandler] = useState<string>("");
	const [internalNotes, setInternalNotes] = useState<string>("");
	const [resolutionNotes, setResolutionNotes] = useState<string>("");
	const [notesModified, setNotesModified] = useState(false);
	const [resolutionModified, setResolutionModified] = useState(false);
	const [userSelectOpen, setUserSelectOpen] = useState(false);
	const [userSearch, setUserSearch] = useState("");

	const {
		data: ticket,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["admin-ticket", ticketId],
		queryFn: async () => {
			return await trpc.tickets.get.query({ id: ticketId });
		},
	});

	const { data: users, isLoading: usersLoading } = useQuery({
		queryKey: ["users-for-assignment", userSearch],
		queryFn: async () => {
			return await trpc.users.list.query({
				search: userSearch || undefined,
				limit: 25,
			});
		},
		enabled: userSelectOpen,
	});

	// Get current handler info for display
	const selectedHandlerUser = users?.users?.find(
		(u: { id: number }) => u.id.toString() === selectedHandler,
	);

	// Set initial values when ticket loads
	if (ticket && !selectedStatus) {
		setSelectedStatus(ticket.status);
		setSelectedHandler(ticket.handlerId?.toString() ?? "");
		setInternalNotes(ticket.internalNotes ?? "");
		setResolutionNotes(ticket.resolutionNotes ?? "");
	}

	const updateStatusMutation = useMutation({
		mutationFn: async (newStatus: string) => {
			return await trpc.tickets.updateStatus.mutate({
				id: ticketId,
				status: newStatus as
					| "pending"
					| "in_progress"
					| "resolved"
					| "closed"
					| "cancelled",
			});
		},
		onSuccess: () => {
			toast.success("Ticket status updated");
			queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
			queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
		},
		onError: (error) => {
			toast.error(`Failed to update status: ${error.message}`);
		},
	});

	const assignMutation = useMutation({
		mutationFn: async (handlerId: number | null) => {
			return await trpc.tickets.assign.mutate({
				id: ticketId,
				handlerId: handlerId,
			});
		},
		onSuccess: () => {
			toast.success("Ticket assignment updated");
			queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
			queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
		},
		onError: (error) => {
			toast.error(`Failed to update assignment: ${error.message}`);
		},
	});

	const updateNotesMutation = useMutation({
		mutationFn: async ({
			internalNotes,
			resolutionNotes,
		}: {
			internalNotes?: string | null;
			resolutionNotes?: string | null;
		}) => {
			return await trpc.tickets.updateNotes.mutate({
				id: ticketId,
				internalNotes,
				resolutionNotes,
			});
		},
		onSuccess: () => {
			toast.success("Notes saved");
			setNotesModified(false);
			setResolutionModified(false);
			queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
		},
		onError: (error) => {
			toast.error(`Failed to save notes: ${error.message}`);
		},
	});

	const handleStatusChange = (newStatus: string) => {
		setSelectedStatus(newStatus);
		if (newStatus !== ticket?.status) {
			updateStatusMutation.mutate(newStatus);
		}
	};

	const handleAssignmentChange = (newHandler: string) => {
		setSelectedHandler(newHandler);
		const handlerValue =
			newHandler === "unassigned" ? null : Number(newHandler);
		if (handlerValue !== ticket?.handlerId) {
			assignMutation.mutate(handlerValue);
		}
	};

	const handleInternalNotesChange = (notes: string) => {
		setInternalNotes(notes);
		setNotesModified(notes !== (ticket?.internalNotes ?? ""));
	};

	const handleResolutionNotesChange = (notes: string) => {
		setResolutionNotes(notes);
		setResolutionModified(notes !== (ticket?.resolutionNotes ?? ""));
	};

	const saveNotes = () => {
		updateNotesMutation.mutate({
			internalNotes: internalNotes || null,
			resolutionNotes: resolutionNotes || null,
		});
	};

	if (isLoading) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Ticket Details</PageTitle>
				</PageHeader>
				<PageContent>
					<Skeleton className="h-64" />
				</PageContent>
			</Page>
		);
	}

	if (error || !ticket) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Ticket Details</PageTitle>
				</PageHeader>
				<PageContent>
					<Alert variant="destructive">
						<AlertTriangleIcon className="h-4 w-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Failed to load ticket details. The ticket may not exist.
						</AlertDescription>
					</Alert>
					<Button
						variant="outline"
						onClick={() => navigate({ to: "/app/tickets/admin" })}
						className="mt-4"
					>
						<ArrowLeftIcon className="h-4 w-4 mr-2" />
						Back to All Tickets
					</Button>
				</PageContent>
			</Page>
		);
	}

	const Icon = ticketTypeIcons[ticket.ticketType.name] ?? AlertTriangleIcon;
	const ticketData = ticket.data as Record<string, unknown>;

	return (
		<Page>
			<PageHeader>
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => navigate({ to: "/app/tickets/admin" })}
					>
						<ArrowLeftIcon className="h-4 w-4" />
					</Button>
					<div className="flex items-center gap-3">
						<div
							className="flex h-10 w-10 items-center justify-center rounded-lg"
							style={{
								backgroundColor: ticket.ticketType.color
									? `${ticket.ticketType.color}20`
									: undefined,
							}}
						>
							<Icon
								className="h-5 w-5"
								style={{ color: ticket.ticketType.color ?? undefined }}
							/>
						</div>
						<div>
							<PageTitle>
								{ticket.ticketType.name
									.split("-")
									.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
									.join(" ")}
							</PageTitle>
							<p className="text-sm text-muted-foreground">
								Submitted {new Date(ticket.createdAt).toLocaleString()}
							</p>
						</div>
					</div>
				</div>
			</PageHeader>

			<PageContent>
				<div className="grid gap-6 md:grid-cols-3">
					{/* Main Content */}
					<div className="md:col-span-2 space-y-6">
						{/* Ticket Data */}
						<Card>
							<CardHeader>
								<CardTitle>Ticket Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<DynamicTicketDetails
									data={ticketData}
									fields={
										(
											ticket.ticketType.fieldSchema as {
												fields: TicketField[];
											} | null
										)?.fields ?? []
									}
								/>
							</CardContent>
						</Card>

						{/* Internal Notes */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center justify-between">
									Internal Notes
									{(notesModified || resolutionModified) && (
										<Button
											size="sm"
											onClick={saveNotes}
											disabled={updateNotesMutation.isPending}
										>
											<SaveIcon className="h-4 w-4 mr-2" />
											Save Notes
										</Button>
									)}
								</CardTitle>
								<CardDescription>
									These notes are only visible to staff members
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Textarea
									placeholder="Add internal notes about this ticket..."
									value={internalNotes}
									onChange={(e) => handleInternalNotesChange(e.target.value)}
									rows={3}
								/>
							</CardContent>
						</Card>

						{/* Resolution Notes */}
						<Card>
							<CardHeader>
								<CardTitle>Resolution Notes</CardTitle>
								<CardDescription>
									These notes will be visible to the ticket submitter
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Textarea
									placeholder="Add resolution notes (visible to submitter)..."
									value={resolutionNotes}
									onChange={(e) => handleResolutionNotesChange(e.target.value)}
									rows={3}
								/>
							</CardContent>
						</Card>

						{/* Status History */}
						{ticket.statusHistory && ticket.statusHistory.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle>Status History</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										{ticket.statusHistory.map((history) => {
											const historyStyle =
												statusStyles[history.newStatus] ?? statusStyles.pending;
											return (
												<div
													key={history.id}
													className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
												>
													<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
														{history.newStatus === "resolved" ||
														history.newStatus === "closed" ? (
															<CheckCircleIcon className="h-4 w-4 text-green-500" />
														) : (
															<ClockIcon className="h-4 w-4 text-muted-foreground" />
														)}
													</div>
													<div className="flex-1">
														<div className="flex items-center gap-2">
															<Badge variant={historyStyle.variant}>
																{historyStyle.label}
															</Badge>
															<span className="text-sm text-muted-foreground">
																{new Date(history.createdAt).toLocaleString()}
															</span>
														</div>
														<p className="mt-1 text-sm text-muted-foreground">
															Changed by {history.changedBy?.name ?? "System"}
														</p>
														{history.notes && (
															<p className="mt-1 text-sm">{history.notes}</p>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</CardContent>
							</Card>
						)}
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Status & Assignment Card */}
						<Card>
							<CardHeader>
								<CardTitle>Manage Ticket</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<label
										htmlFor="ticketStatus"
										className="text-sm font-medium mb-2 block"
									>
										Status
									</label>
									<Select
										value={selectedStatus}
										onValueChange={handleStatusChange}
										disabled={updateStatusMutation.isPending}
									>
										<SelectTrigger id="ticketStatus">
											<SelectValue placeholder="Select status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="pending">Pending</SelectItem>
											<SelectItem value="in_progress">In Progress</SelectItem>
											<SelectItem value="resolved">Resolved</SelectItem>
											<SelectItem value="closed">Closed</SelectItem>
											<SelectItem value="cancelled">Cancelled</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<Separator />

								<div>
									<label
										htmlFor="assignedTo"
										className="text-sm font-medium mb-2 block"
									>
										Assigned To
									</label>
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
												disabled={assignMutation.isPending}
											>
												{selectedHandler && selectedHandler !== "unassigned" ? (
													<span className="truncate">
														{selectedHandlerUser?.name ??
															ticket?.handler?.name ??
															"Loading..."}
													</span>
												) : (
													"Unassigned"
												)}
												<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[300px] p-0">
											<Command shouldFilter={false}>
												<CommandInput
													placeholder="Search users..."
													value={userSearch}
													onValueChange={setUserSearch}
												/>
												<CommandList>
													<CommandEmpty>
														{usersLoading ? "Loading..." : "No users found."}
													</CommandEmpty>
													<CommandGroup>
														<CommandItem
															value="unassigned"
															onSelect={() => {
																handleAssignmentChange("unassigned");
																setUserSelectOpen(false);
															}}
														>
															<CheckIcon
																className={cn(
																	"mr-2 h-4 w-4",
																	!selectedHandler ||
																		selectedHandler === "unassigned"
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															Unassigned
														</CommandItem>
														{users?.users?.map(
															(user: {
																id: number;
																name: string;
																username: string;
																email: string;
															}) => (
																<CommandItem
																	key={user.id}
																	value={user.id.toString()}
																	onSelect={() => {
																		handleAssignmentChange(user.id.toString());
																		setUserSelectOpen(false);
																	}}
																>
																	<CheckIcon
																		className={cn(
																			"mr-2 h-4 w-4",
																			selectedHandler === user.id.toString()
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
															),
														)}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								</div>
							</CardContent>
						</Card>

						{/* Submitter Info */}
						<Card>
							<CardHeader>
								<CardTitle>Submitter Information</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{ticket.submitter ? (
									<>
										<div className="flex items-center gap-2">
											<UserIcon className="h-4 w-4 text-muted-foreground" />
											<span>{ticket.submitter.name}</span>
										</div>
										{ticket.submitter.email && (
											<a
												href={`mailto:${ticket.submitter.email}`}
												className="text-sm text-primary hover:underline"
											>
												{ticket.submitter.email}
											</a>
										)}
									</>
								) : (
									<>
										{ticket.submitterName && (
											<div className="flex items-center gap-2">
												<UserIcon className="h-4 w-4 text-muted-foreground" />
												<span>{ticket.submitterName}</span>
											</div>
										)}
										{ticket.submitterEmail && (
											<a
												href={`mailto:${ticket.submitterEmail}`}
												className="text-sm text-primary hover:underline"
											>
												{ticket.submitterEmail}
											</a>
										)}
										<Badge variant="outline">Anonymous Submission</Badge>
									</>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</PageContent>
		</Page>
	);
}
