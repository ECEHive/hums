import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon, ClockIcon } from "lucide-react";
import React from "react";
import { RequireAuth } from "@/auth";
import { columns } from "@/components/my-sessions/columns";
import { DataTable } from "@/components/my-sessions/data-table";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/my-sessions")({
	component: () => RequireAuth({ children: <MySessionsPage /> }),
});

function MySessionsPage() {
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const limit = pageSize;
	const offset = (page - 1) * limit;

	const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
		queryKey: ["mySessions", page, limit],
		queryFn: async () => {
			return trpc.sessions.listMy.query({
				limit,
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
	const total = sessionsData?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">My Sessions</h1>

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
							{statsData?.currentlyActive ? "in a session" : "not in a session"}
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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									{pageSize} per page{" "}
									<ChevronDownIcon className="ml-2 size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{[10, 20, 50, 100].map((size) => (
									<DropdownMenuItem
										key={size}
										onClick={() => {
											setPageSize(size);
											setPage(1);
										}}
									>
										{size} per page
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={sessions}
						isLoading={sessionsLoading}
					/>
					{total > 0 && (
						<div className="flex flex-col justify-between items-center gap-2 mt-4">
							<TablePagination
								page={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
							<p className="text-sm text-muted-foreground">
								Showing {offset + 1} - {offset + sessions.length} of {total}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
