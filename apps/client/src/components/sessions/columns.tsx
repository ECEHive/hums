import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import type { AuthUser } from "@/auth";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";
import { formatInAppTimezone } from "@/lib/timezone";

type Session = {
	id: number;
	userId: number;
	sessionType: "regular" | "staffing";
	startedAt: Date;
	endedAt: Date | null;
	user: {
		id: number;
		name: string;
		username: string;
		email: string;
	};
};

const formatDate = (date: Date) => formatInAppTimezone(date);

const formatDuration = (start: Date, end: Date | null) => {
	const startTime = new Date(start).getTime();
	const endTime = end ? new Date(end).getTime() : Date.now();
	const durationMs = endTime - startTime;
	const hours = Math.floor(durationMs / (1000 * 60 * 60));
	const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
	return `${hours}h ${minutes}m`;
};

function EndSessionButton({ session }: { session: Session }) {
	const queryClient = useQueryClient();
	const endSessionMutation = useMutation({
		mutationFn: async () => {
			return await trpc.sessions.adminEndSession.mutate({
				sessionId: session.id,
			});
		},
		onSuccess: () => {
			toast.success("Session ended successfully");
			queryClient.invalidateQueries({ queryKey: ["sessions"] });
			queryClient.invalidateQueries({ queryKey: ["sessionsStats"] });
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to end session");
		},
	});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
				>
					<XCircle className="h-4 w-4 mr-1" />
					End
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>End Session?</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to end {session.user.name}'s session? This
						action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={endSessionMutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault();
							endSessionMutation.mutate();
						}}
						disabled={endSessionMutation.isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{endSessionMutation.isPending ? (
							<>
								<Spinner className="mr-2 h-3 w-3" />
								Ending...
							</>
						) : (
							"End Session"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export function generateColumns(user: AuthUser | null): ColumnDef<Session>[] {
	const canManageSessions = user && checkPermissions(user, ["sessions.manage"]);

	const baseColumns: ColumnDef<Session>[] = [
		{
			accessorKey: "user.name",
			header: "User",
			cell: ({ row }) => {
				const session = row.original;
				return (
					<div className="flex flex-col">
						<span className="font-medium">{session.user.name}</span>
						<span className="text-xs text-muted-foreground">
							{session.user.username}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "sessionType",
			header: "Type",
			cell: ({ row }) => {
				const session = row.original;
				return (
					<Badge
						variant={session.sessionType === "staffing" ? "default" : "outline"}
					>
						{session.sessionType === "staffing" ? "Staffing" : "Regular"}
					</Badge>
				);
			},
		},
		{
			accessorKey: "startedAt",
			header: "Started",
			cell: ({ row }) => formatDate(row.original.startedAt),
		},
		{
			accessorKey: "endedAt",
			header: "Ended",
			cell: ({ row }) => {
				const session = row.original;
				return session.endedAt ? formatDate(session.endedAt) : "-";
			},
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => {
				const session = row.original;
				return formatDuration(session.startedAt, session.endedAt);
			},
		},
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => {
				const session = row.original;
				return session.endedAt ? (
					<span className="text-muted-foreground">Ended</span>
				) : (
					<span className="text-green-600 font-medium">Active</span>
				);
			},
		},
	];

	// Add actions column if user has permission to manage sessions
	if (canManageSessions) {
		baseColumns.push({
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const session = row.original;
				// Only show button for active sessions
				if (session.endedAt !== null) {
					return null;
				}
				return <EndSessionButton session={session} />;
			},
		});
	}

	return baseColumns;
}
