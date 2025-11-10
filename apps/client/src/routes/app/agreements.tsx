import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { generateColumns } from "@/components/agreements/columns";
import { CreateDialog } from "@/components/agreements/create-dialog";
import { DataTable } from "@/components/agreements/data-table";
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
import { useDebounce } from "@/lib/debounce";

export const Route = createFileRoute("/app/agreements")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Agreements />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["agreements.list"];

function Agreements() {
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(10);
	const [search, setSearch] = React.useState("");
	const debouncedSearch = useDebounce(search, 300);

	const offset = (page - 1) * pageSize;

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize]);

	const { data = { agreements: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["agreements", queryParams],
		queryFn: async () => {
			return await trpc.agreements.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const total = data?.total || 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Agreements</h1>

			<div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
				<Input
					placeholder="Search agreements..."
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="max-w-xs"
				/>
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
					<CreateDialog />
				</div>
			</div>
			<DataTable
				columns={columns}
				data={data.agreements}
				isLoading={isLoading}
			/>
			<TablePagination
				page={page}
				totalPages={totalPages}
				onPageChange={setPage}
			/>
		</div>
	);
}
