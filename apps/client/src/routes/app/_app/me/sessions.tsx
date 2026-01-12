import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ClockIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RequireAuth } from "@/auth";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableToolbar,
} from "@/components/layout";
import { columns } from "@/components/my-sessions/columns";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/_app/me/sessions")({
	component: () => RequireAuth({ children: <MySessionsPage /> }),
});

function MySessionsPage() {
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState({ initialPageSize: 20 });
	const queryClient = useQueryClient();
	const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);

	const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
		queryKey: ["mySessions", page, pageSize],
		queryFn: async () => {
			return trpc.sessions.listMy.query({
				limit: pageSize,
				offset,
			});
		},
		refetchInterval: 5000,
	});

	const { data: statsData } = useQuery({
		queryKey: ["mySessionStats"],
		queryFn: async () => {
			return trpc.sessions.myStats.query({});
		},
		refetchInterval: 5000,
	});

	const endSessionMutation = useMutation({
		mutationFn: async () => {
			return trpc.sessions.endMySession.mutate({});
		},
		onSuccess: () => {
			toast.success("Session ended successfully");
			queryClient.invalidateQueries({ queryKey: ["mySessionStats"] });
			queryClient.invalidateQueries({ queryKey: ["mySessions"] });
			setShowEndSessionDialog(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to end session");
			setShowEndSessionDialog(false);
		},
	});

	const handleEndSession = () => {
		endSessionMutation.mutate();
	};

	const canEndSession =
		statsData?.currentlyActive && statsData?.activeSessionType === "regular";

	const sessions = sessionsData?.sessions ?? [];
	const { totalPages } = usePaginationInfo({
		total: sessionsData?.total ?? 0,
		pageSize,
		offset,
		currentCount: sessions.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Sessions</PageTitle>
			</PageHeader>

			<PageContent>
				{/* Active Session Alert */}
				{canEndSession && (
					<Alert className="mb-6">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>You have an active general session.</AlertTitle>
						<AlertDescription className="flex items-center justify-between">
							<span>You can end it here or at a kiosk.</span>
							<Button
								onClick={() => setShowEndSessionDialog(true)}
								size="sm"
								variant="destructive"
								className="ml-4 flex-shrink-0"
							>
								<LogOut className="mr-2 h-3 w-3" />
								End Session
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Sessions
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{statsData?.totalSessions ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">sessions</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Hours</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{statsData?.totalHours ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">hours logged</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Average Session
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{statsData?.averageSessionHours ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">hours per session</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Status</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{!statsData?.currentlyActive ? (
									<span className="text-muted-foreground">Inactive</span>
								) : statsData.activeSessionType === "staffing" ? (
									<span className="text-green-600">Staffing</span>
								) : (
									<span className="text-green-600">Active</span>
								)}
							</div>
							<p className="text-xs text-muted-foreground">
								{statsData?.currentlyActive
									? "in a session"
									: "not in a session"}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Sessions Table */}
				<Card>
					<CardHeader>
						<div className="flex justify-between items-center">
							<div>
								<CardTitle>Session History</CardTitle>
								<CardDescription>
									View all your session check-ins and check-outs
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<TableContainer>
							<TableToolbar>
								<div />
							</TableToolbar>

							<DataTable
								columns={columns}
								data={sessions}
								isLoading={sessionsLoading}
								emptyMessage="No sessions found"
								emptyDescription="Your session history will appear here"
							/>

							{sessionsData && sessionsData.total > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={sessions.length}
									total={sessionsData.total}
									itemName="sessions"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										resetToFirstPage();
									}}
									pageSizeOptions={[10, 20, 50, 100]}
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>
			</PageContent>

			<AlertDialog
				open={showEndSessionDialog}
				onOpenChange={setShowEndSessionDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>End Current Session?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to end your current session? This action
							cannot be undone and your session will be terminated immediately.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={endSessionMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleEndSession}
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
		</Page>
	);
}
