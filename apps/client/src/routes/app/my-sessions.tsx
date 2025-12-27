import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClockIcon } from "lucide-react";
import { RequireAuth } from "@/auth";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
	TableActions,
	TableContainer,
	TableToolbar,
} from "@/components/layout";
import { columns } from "@/components/my-sessions/columns";
import {
	DataTable,
	PageSizeSelect,
	TablePaginationFooter,
} from "@/components/shared";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/my-sessions")({
	component: () => RequireAuth({ children: <MySessionsPage /> }),
});

function MySessionsPage() {
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState({ initialPageSize: 20 });

	const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
		queryKey: ["mySessions", page, pageSize],
		queryFn: async () => {
			return trpc.sessions.listMy.query({
				limit: pageSize,
				offset,
			});
		},
	});

	const { data: statsData } = useQuery({
		queryKey: ["mySessionStats"],
		queryFn: async () => {
			return trpc.sessions.myStats.query({});
		},
	});

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
				{/* Stats Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
								<TableActions>
									<PageSizeSelect
										pageSize={pageSize}
										onPageSizeChange={(size) => {
											setPageSize(size);
											resetToFirstPage();
										}}
										pageSizeOptions={[10, 20, 50, 100]}
									/>
								</TableActions>
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
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
