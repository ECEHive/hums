import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon, Filter } from "lucide-react";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Role } from "@/components/users/columns";
import { generateColumns } from "@/components/users/columns";
import { CreateDialog } from "@/components/users/create-dialog";
import { DataTable } from "@/components/users/data-table";
import { FilterDialog } from "@/components/users/filter-dialog";
import { useDebounce } from "@/lib/debounce";

export const Route = createFileRoute("/app/users")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Users />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["users.list"];

function Users() {
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(10);
	const [search, setSearch] = React.useState("");
	const [filterRoles, setFilterRoles] = React.useState<Role[]>([]);
	const debouncedSearch = useDebounce(search, 300);

	const offset = (page - 1) * pageSize;

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			filterRoles,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize]);

	const { data = { users: [], total: 0 }, isLoading } = useQuery({
		// filterRoles needs to be an array of IDs for the query key to work properly
		queryKey: [
			"users",
			{ ...queryParams, filterRoles: filterRoles.map((r) => r.id) },
		],
		queryFn: async () => {
			return await trpc.users.list.query({
				...queryParams,
				filterRoles: filterRoles.map((r) => r.id),
			});
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	return (
		<div className="container p-4 space-y-3">
			<div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
				<div className="flex items-center gap-2">
					<FilterDialog
						onFilterChange={(newFilterRoles) => {
							setPage(1);
							setFilterRoles(newFilterRoles);
						}}
						filterRoles={filterRoles}
						trigger={
							<Button variant="outline">
								<Filter className="size-4" />
							</Button>
						}
					/>
					<Input
						placeholder="Search users..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="max-w-xs"
					/>
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								{pageSize} per page <ChevronDownIcon className="ml-2 size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{[10, 25, 50, 100].map((size) => (
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
					<CreateDialog onUpdate={() => setPage(1)} />
				</div>
			</div>
			<DataTable columns={columns} data={data.users} isLoading={isLoading} />
			<div className="flex flex-col justify-between items-center gap-2">
				<TablePagination
					page={page}
					totalPages={totalPages}
					onPageChange={setPage}
				/>
				<p className="text-sm text-muted-foreground">
					Showing {offset + 1} - {offset + data.users.length} of {total}
				</p>
			</div>
		</div>
	);
}
