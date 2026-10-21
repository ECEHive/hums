import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
	CheckIcon,
	ChevronsUpDownIcon,
	DownloadIcon,
	Loader2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { exportToCSV } from "@/lib/reports";
import { cn } from "@/lib/utils";

type SessionType = "regular" | "staffing";

type ExportUser = {
	id: number;
	name: string;
	username: string;
	email: string;
};

type SessionExportRow = {
	id: number;
	userId: number;
	userName: string;
	username: string;
	email: string;
	sessionType: SessionType;
	startedAt: Date;
	endedAt: Date | null;
};

type SessionsExportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionType: SessionType | null;
	onSessionTypeChange: (sessionType: SessionType | null) => void;
};

export function SessionsExportDialog({
	open,
	onOpenChange,
	sessionType,
	onSessionTypeChange,
}: SessionsExportDialogProps) {
	const [selectedUser, setSelectedUser] = useState<ExportUser | null>(null);
	const [userSelectOpen, setUserSelectOpen] = useState(false);
	const [userSearch, setUserSearch] = useState("");
	const [isExporting, setIsExporting] = useState(false);

	const { data: users = [], isLoading: usersLoading } = useQuery({
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

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const rows: SessionExportRow[] = [];
			let offset = 0;
			let total = 0;

			do {
				const result = await trpc.sessions.list.query({
					limit: 100,
					offset,
					filterSessionType: sessionType ?? undefined,
					filterUserId: selectedUser?.id,
				});
				total = result.total;
				rows.push(
					...result.sessions.map((session) => ({
						id: session.id,
						userId: session.userId,
						userName: session.user.name,
						username: session.user.username,
						email: session.user.email,
						sessionType: session.sessionType,
						startedAt: session.startedAt,
						endedAt: session.endedAt,
					})),
				);
				offset += result.sessions.length;
			} while (offset < total);

			if (rows.length === 0) {
				toast.info("No sessions match the selected filters");
				return;
			}

			exportToCSV(rows, "sessions", [
				{ key: "id", label: "Session ID" },
				{ key: "userId", label: "User ID" },
				{ key: "userName", label: "User Name" },
				{ key: "username", label: "Username" },
				{ key: "email", label: "Email" },
				{ key: "sessionType", label: "Session Type" },
				{ key: "startedAt", label: "Started At" },
				{ key: "endedAt", label: "Ended At" },
			]);
			toast.success(`Exported ${rows.length} sessions`);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to export sessions",
			);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Export Sessions</DialogTitle>
					<DialogDescription>
						Export all sessions matching the selected filters as a CSV file.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>Session Type</Label>
						<Select
							value={sessionType ?? "all"}
							onValueChange={(value) =>
								onSessionTypeChange(
									value === "all" ? null : (value as SessionType),
								)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="All types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All types</SelectItem>
								<SelectItem value="regular">Regular</SelectItem>
								<SelectItem value="staffing">Staffing</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>User</Label>
						<Popover open={userSelectOpen} onOpenChange={setUserSelectOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									role="combobox"
									aria-expanded={userSelectOpen}
									className="w-full justify-between"
								>
									<span className="truncate">
										{selectedUser?.name ?? "All users"}
									</span>
									<ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
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
											<CommandItem
												value="all-users"
												onSelect={() => {
													setSelectedUser(null);
													setUserSelectOpen(false);
												}}
											>
												<CheckIcon
													className={cn(
														"mr-2 size-4",
														selectedUser === null ? "opacity-100" : "opacity-0",
													)}
												/>
												All users
											</CommandItem>
											{users.map((user) => (
												<CommandItem
													key={user.id}
													value={user.id.toString()}
													onSelect={() => {
														setSelectedUser(user);
														setUserSelectOpen(false);
													}}
												>
													<CheckIcon
														className={cn(
															"mr-2 size-4",
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
				</div>
				<DialogFooter>
					<Button onClick={handleExport} disabled={isExporting}>
						{isExporting ? (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<DownloadIcon className="mr-2 h-4 w-4" />
						)}
						{isExporting ? "Exporting..." : "Export CSV"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
