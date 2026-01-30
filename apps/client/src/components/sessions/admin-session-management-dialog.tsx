import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	Check,
	ChevronsUpDown,
	Clock,
	History,
	LogOut,
	PlayCircle,
	RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type AdminSessionManagementDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type User = {
	id: number;
	name: string;
	username: string;
	email: string;
};

export function AdminSessionManagementDialog({
	open,
	onOpenChange,
}: AdminSessionManagementDialogProps) {
	const queryClient = useQueryClient();
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [userSelectOpen, setUserSelectOpen] = useState(false);
	const [userSearch, setUserSearch] = useState("");

	// Create past session form state
	const [showCreatePastSession, setShowCreatePastSession] = useState(false);
	const [pastSessionType, setPastSessionType] = useState<
		"regular" | "staffing"
	>("regular");
	const [pastStartDate, setPastStartDate] = useState("");
	const [pastEndDate, setPastEndDate] = useState("");

	// Fetch users for selection
	const { data: usersData, isLoading: usersLoading } = useQuery({
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

	// Fetch selected user's current session status
	const { data: sessionStats, isLoading: sessionStatsLoading } = useQuery({
		queryKey: ["userSessionStats", selectedUser?.id],
		queryFn: async () => {
			if (!selectedUser) return null;
			// Get the user's current session by checking sessions list
			const result = await trpc.sessions.list.query({
				filterUserId: selectedUser.id,
				limit: 1,
			});
			const currentSession = result.sessions.find((s) => s.endedAt === null);
			return {
				currentlyActive: !!currentSession,
				activeSessionType: currentSession?.sessionType,
				currentSession,
			};
		},
		enabled: open && !!selectedUser,
	});

	// Check if selected user has staffing permission
	const { data: userData } = useQuery({
		queryKey: ["user", selectedUser?.id],
		queryFn: async () => {
			if (!selectedUser) return null;
			return await trpc.users.get.query({ id: selectedUser.id });
		},
		enabled: open && !!selectedUser,
	});

	// Check if user has staffing permission by looking at their permissions in their roles
	const hasStaffingPermission =
		userData?.user?.isSystemUser ||
		userData?.user?.roles?.some(
			(role: { name: string; permissions?: Array<{ name: string }> }) =>
				role.permissions?.some(
					(perm: { name: string }) => perm.name === "sessions.staffing",
				),
		) ||
		false;

	// Mutation for managing sessions
	const manageMutation = useMutation({
		mutationFn: async (
			action:
				| "start_general"
				| "start_staffing"
				| "end_current"
				| "switch_to_general"
				| "switch_to_staffing",
		) => {
			if (!selectedUser) throw new Error("No user selected");
			return await trpc.sessions.adminManageSession.mutate({
				userId: selectedUser.id,
				action,
			});
		},
		onSuccess: (data) => {
			const actionMessages = {
				started_general: "Started general session",
				started_staffing: "Started staffing session",
				ended_session: "Ended session",
				switched_to_general: "Switched to general session",
				switched_to_staffing: "Switched to staffing session",
			};
			toast.success(
				actionMessages[data.action as keyof typeof actionMessages] ||
					"Session updated",
			);
			queryClient.invalidateQueries({ queryKey: ["sessions"] });
			queryClient.invalidateQueries({ queryKey: ["sessionsStats"] });
			queryClient.invalidateQueries({
				queryKey: ["userSessionStats", selectedUser?.id],
			});
			onOpenChange(false);
			setSelectedUser(null);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to manage session");
		},
	});

	// Mutation for creating past sessions
	const createPastSessionMutation = useMutation({
		mutationFn: async (data: {
			userId: number;
			sessionType: "regular" | "staffing";
			startedAt: Date;
			endedAt: Date;
		}) => {
			return await trpc.sessions.adminCreatePastSession.mutate(data);
		},
		onSuccess: (data) => {
			toast.success(
				`Created past session (${data.durationFormatted}) for ${data.user.name}`,
			);
			queryClient.invalidateQueries({ queryKey: ["sessions"] });
			queryClient.invalidateQueries({ queryKey: ["sessionsStats"] });
			queryClient.invalidateQueries({
				queryKey: ["userSessionStats", selectedUser?.id],
			});
			resetCreatePastSessionForm();
			onOpenChange(false);
			setSelectedUser(null);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to create past session");
		},
	});

	const users = usersData ?? [];
	const isInSession = sessionStats?.currentlyActive ?? false;
	const currentSessionType = sessionStats?.activeSessionType;

	// Calculate session duration for preview
	const sessionDurationInfo = useMemo(() => {
		if (!pastStartDate || !pastEndDate) return null;

		const start = new Date(pastStartDate);
		const end = new Date(pastEndDate);
		const now = new Date();

		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			return null;
		}

		const errors: string[] = [];

		if (start >= now) {
			errors.push("Start date must be in the past");
		}
		if (end >= now) {
			errors.push("End date must be in the past");
		}
		if (start >= end) {
			errors.push("Start date must be before end date");
		}

		if (errors.length > 0) {
			return { errors, durationMs: 0, formatted: "" };
		}

		const durationMs = end.getTime() - start.getTime();
		const durationMinutes = Math.round(durationMs / (1000 * 60));
		const hours = Math.floor(durationMinutes / 60);
		const minutes = durationMinutes % 60;
		const formatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

		return { errors: [], durationMs, formatted };
	}, [pastStartDate, pastEndDate]);

	const resetCreatePastSessionForm = () => {
		setShowCreatePastSession(false);
		setPastSessionType("regular");
		setPastStartDate("");
		setPastEndDate("");
	};

	const handleReset = () => {
		setSelectedUser(null);
		setUserSearch("");
		resetCreatePastSessionForm();
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			handleReset();
		}
		onOpenChange(newOpen);
	};

	const handleCreatePastSession = () => {
		if (!selectedUser || !pastStartDate || !pastEndDate) return;

		const start = new Date(pastStartDate);
		const end = new Date(pastEndDate);

		createPastSessionMutation.mutate({
			userId: selectedUser.id,
			sessionType: pastSessionType,
			startedAt: start,
			endedAt: end,
		});
	};

	const canSubmitPastSession =
		selectedUser &&
		pastStartDate &&
		pastEndDate &&
		sessionDurationInfo &&
		sessionDurationInfo.errors.length === 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Manage User Session</DialogTitle>
					<DialogDescription>
						Start, end, or switch sessions for any user.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* User Selection */}
					<div className="space-y-2">
						<div className="text-sm font-medium">Select User</div>
						<Popover open={userSelectOpen} onOpenChange={setUserSelectOpen}>
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
											{usersLoading ? "Loading..." : "No users found."}
										</CommandEmpty>
										<CommandGroup>
											{users.map((user) => (
												<CommandItem
													key={user.id}
													value={user.id.toString()}
													onSelect={() => {
														setSelectedUser(user);
														setUserSelectOpen(false);
														resetCreatePastSessionForm();
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
														<span className="font-medium">{user.name}</span>
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
					</div>

					{/* Session Actions */}
					{selectedUser && (
						<div className="space-y-4">
							{sessionStatsLoading ? (
								<div className="flex items-center justify-center py-8">
									<Spinner className="h-8 w-8" />
								</div>
							) : (
								<>
									{/* Current Status */}
									<div className="rounded-lg border p-4 space-y-2">
										<div className="text-sm font-medium">Current Status</div>
										<div className="flex items-center gap-2">
											{isInSession ? (
												<>
													<Badge variant="default">Active</Badge>
													<span className="text-sm text-muted-foreground">
														{currentSessionType === "staffing"
															? "Staffing Session"
															: "General Session"}
													</span>
												</>
											) : (
												<>
													<Badge variant="outline">Inactive</Badge>
													<span className="text-sm text-muted-foreground">
														No active session
													</span>
												</>
											)}
										</div>
									</div>

									{/* Action Buttons */}
									<div className="space-y-2">
										<div className="text-sm font-medium">Actions</div>
										<div className="grid gap-2">
											{!hasStaffingPermission ? (
												<>
													{/* User WITHOUT staffing permission */}
													{isInSession ? (
														<Button
															onClick={() =>
																manageMutation.mutate("end_current")
															}
															disabled={manageMutation.isPending}
															variant="destructive"
															className="w-full justify-start"
														>
															<LogOut className="mr-2 h-4 w-4" />
															End Current Session
														</Button>
													) : (
														<Button
															onClick={() =>
																manageMutation.mutate("start_general")
															}
															disabled={manageMutation.isPending}
															variant="default"
															className="w-full justify-start"
														>
															<PlayCircle className="mr-2 h-4 w-4" />
															Start General Session
														</Button>
													)}
												</>
											) : (
												<>
													{/* User WITH staffing permission */}
													{isInSession ? (
														<>
															<Button
																onClick={() =>
																	manageMutation.mutate(
																		currentSessionType === "staffing"
																			? "switch_to_general"
																			: "switch_to_staffing",
																	)
																}
																disabled={manageMutation.isPending}
																variant="outline"
																className="w-full justify-start"
															>
																<RefreshCw className="mr-2 h-4 w-4" />
																Switch to{" "}
																{currentSessionType === "staffing"
																	? "General"
																	: "Staffing"}
															</Button>
															<Button
																onClick={() =>
																	manageMutation.mutate("end_current")
																}
																disabled={manageMutation.isPending}
																variant="destructive"
																className="w-full justify-start"
															>
																<LogOut className="mr-2 h-4 w-4" />
																End Current Session
															</Button>
														</>
													) : (
														<>
															<Button
																onClick={() =>
																	manageMutation.mutate("start_general")
																}
																disabled={manageMutation.isPending}
																variant="default"
																className="w-full justify-start"
															>
																<PlayCircle className="mr-2 h-4 w-4" />
																Start General Session
															</Button>
															<Button
																onClick={() =>
																	manageMutation.mutate("start_staffing")
																}
																disabled={manageMutation.isPending}
																variant="default"
																className="w-full justify-start"
															>
																<PlayCircle className="mr-2 h-4 w-4" />
																Start Staffing Session
															</Button>
														</>
													)}
												</>
											)}
										</div>
									</div>

									<Separator />

									{/* Create Past Session Section */}
									<div className="space-y-3">
										{!showCreatePastSession ? (
											<Button
												variant="outline"
												className="w-full justify-start"
												onClick={() => setShowCreatePastSession(true)}
											>
												<History className="mr-2 h-4 w-4" />
												Create Past Session
											</Button>
										) : (
											<div className="rounded-lg border p-4 space-y-4">
												<div className="flex items-center justify-between">
													<div className="text-sm font-medium">
														Create Past Session
													</div>
													<Badge variant="secondary">Manual Entry</Badge>
												</div>

												{/* Session Type */}
												<div className="space-y-2">
													<Label htmlFor="pastSessionType">Session Type</Label>
													<Select
														value={pastSessionType}
														onValueChange={(value) =>
															setPastSessionType(
																value as "regular" | "staffing",
															)
														}
													>
														<SelectTrigger id="pastSessionType">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="regular">Regular</SelectItem>
															<SelectItem value="staffing">Staffing</SelectItem>
														</SelectContent>
													</Select>
												</div>

												{/* Start Date/Time */}
												<div className="space-y-2">
													<Label htmlFor="pastStartDate">
														Start Date & Time
													</Label>
													<Input
														id="pastStartDate"
														type="datetime-local"
														value={pastStartDate}
														onChange={(e) => setPastStartDate(e.target.value)}
														max={new Date().toISOString().slice(0, 16)}
													/>
												</div>

												{/* End Date/Time */}
												<div className="space-y-2">
													<Label htmlFor="pastEndDate">End Date & Time</Label>
													<Input
														id="pastEndDate"
														type="datetime-local"
														value={pastEndDate}
														onChange={(e) => setPastEndDate(e.target.value)}
														max={new Date().toISOString().slice(0, 16)}
													/>
												</div>

												{/* Duration Preview / Validation Errors */}
												{sessionDurationInfo &&
													(sessionDurationInfo.errors.length > 0 ? (
														<Alert variant="destructive">
															<AlertCircle className="h-4 w-4" />
															<AlertDescription>
																<ul className="list-disc list-inside">
																	{sessionDurationInfo.errors.map(
																		(error, i) => (
																			<li key={i}>{error}</li>
																		),
																	)}
																</ul>
															</AlertDescription>
														</Alert>
													) : (
														<Alert>
															<Clock className="h-4 w-4" />
															<AlertDescription>
																<span className="font-medium">
																	Session Duration:
																</span>{" "}
																{sessionDurationInfo.formatted}
															</AlertDescription>
														</Alert>
													))}

												{/* Action Buttons */}
												<div className="flex gap-2">
													<Button
														variant="outline"
														className="flex-1"
														onClick={resetCreatePastSessionForm}
													>
														Cancel
													</Button>
													<Button
														className="flex-1"
														onClick={handleCreatePastSession}
														disabled={
															!canSubmitPastSession ||
															createPastSessionMutation.isPending
														}
													>
														{createPastSessionMutation.isPending ? (
															<>
																<Spinner className="mr-2 h-4 w-4" />
																Creating...
															</>
														) : (
															"Create Session"
														)}
													</Button>
												</div>
											</div>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
