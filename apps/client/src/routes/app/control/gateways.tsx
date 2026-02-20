import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertTriangleIcon,
	Loader2Icon,
	NetworkIcon,
	RefreshCcwIcon,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { CreateGatewayDialog } from "@/components/control/create-gateway-dialog";
import { DeleteGatewayDialog } from "@/components/control/delete-gateway-dialog";
import { EditGatewayDialog } from "@/components/control/edit-gateway-dialog";
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
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions as TRequiredPermissions } from "@/lib/permissions";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/control/gateways")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <GatewaysPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = ["control.gateways.list"] as TRequiredPermissions;

type ControlGateway = {
	id: number;
	name: string;
	description: string | null;
	accessToken: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	_count: { actions: number };
};

type GeneratedToken = {
	name: string;
	value: string;
};

function GatewaysPage() {
	const { user } = useAuth();
	const [tokenToShow, setTokenToShow] = useState<GeneratedToken | null>(null);
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		resetToFirstPage,
	} = useTableState();

	const queryParams = React.useMemo(
		() => ({
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		}),
		[debouncedSearch, offset, pageSize],
	);

	const {
		data = { gateways: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["control", "gateways", queryParams],
		queryFn: async () => await trpc.control.gateways.list.query(queryParams),
		retry: false,
	});

	const canCreate = user && checkPermissions(user, ["control.gateways.create"]);
	const canUpdate = user && checkPermissions(user, ["control.gateways.update"]);
	const canDelete = user && checkPermissions(user, ["control.gateways.delete"]);

	const columns: ColumnDef<ControlGateway>[] = [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					<NetworkIcon className="h-4 w-4 text-muted-foreground" />
					<div>
						<span className="font-medium">{row.original.name}</span>
						{row.original.description && (
							<p className="text-xs text-muted-foreground">
								{row.original.description}
							</p>
						)}
					</div>
				</div>
			),
		},
		{
			accessorKey: "accessToken",
			header: "Access Token",
			cell: ({ row }) => (
				<code className="text-xs text-muted-foreground">
					{row.original.accessToken}
				</code>
			),
		},
		{
			accessorKey: "_count.actions",
			header: "Actions",
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{row.original._count.actions}
				</span>
			),
		},
		{
			accessorKey: "isActive",
			header: "Status",
			cell: ({ row }) =>
				row.original.isActive ? (
					<Badge className="bg-green-500">Active</Badge>
				) : (
					<Badge variant="secondary">Inactive</Badge>
				),
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => {
				if (!canUpdate && !canDelete) return null;
				return (
					<div className="flex items-center gap-1">
						{canUpdate && <EditGatewayDialog gateway={row.original} />}
						{canDelete && <DeleteGatewayDialog gateway={row.original} />}
					</div>
				);
			},
		},
	];

	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.gateways.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Control Gateways</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="h-4 w-4" />
						)}
						<span className="ml-2 hidden sm:inline">Refresh</span>
					</Button>
					{canCreate && (
						<CreateGatewayDialog
							onTokenCreated={(payload) => setTokenToShow(payload)}
						/>
					)}
				</PageActions>
			</PageHeader>
			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
								placeholder="Search gateways..."
							/>
						</TableSearchInput>
					</TableToolbar>
					<DataTable
						columns={columns}
						data={data.gateways}
						isLoading={isLoading}
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.gateways.length}
						total={data.total}
						itemName="gateways"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>

				<TokenRevealDialog
					token={tokenToShow}
					onClose={() => setTokenToShow(null)}
				/>
			</PageContent>
		</Page>
	);
}

function TokenRevealDialog({
	token,
	onClose,
}: {
	token: GeneratedToken | null;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);

	return (
		<Dialog
			open={token !== null}
			onOpenChange={(next) => {
				if (!next) {
					setCopied(false);
					onClose();
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Gateway created</DialogTitle>
					<DialogDescription>
						Copy and store this access token in a secure location. You will not
						be able to retrieve it again.
					</DialogDescription>
				</DialogHeader>
				{token && (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Gateway: <span className="font-medium">{token.name}</span>
						</p>
						<div className="rounded border bg-muted/60 p-3 font-mono text-sm break-all">
							{token.value}
						</div>
						<Button
							variant={copied ? "secondary" : "default"}
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(token.value);
									setCopied(true);
									toast.success("Copied token to clipboard");
								} catch {
									toast.error("Unable to copy token");
								}
							}}
						>
							{copied ? "Copied" : "Copy token"}
						</Button>
					</div>
				)}
				<div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100">
					<AlertTriangleIcon className="size-4" />
					<span>
						Store this token securely. Lost tokens require creating a new
						gateway.
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}
