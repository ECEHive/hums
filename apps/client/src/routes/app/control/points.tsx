import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	DoorOpenIcon,
	Loader2Icon,
	PowerIcon,
	PowerOffIcon,
	QrCodeIcon,
	RefreshCcwIcon,
	ToggleLeftIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { CreateControlPointDialog } from "@/components/control/create-point-dialog";
import { DeleteControlPointDialog } from "@/components/control/delete-point-dialog";
import { EditControlPointDialog } from "@/components/control/edit-point-dialog";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions as TRequiredPermissions } from "@/lib/permissions";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/control/points")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ControlPointsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = { any: ["control.points.list"] } as TRequiredPermissions;

type ControlPoint = {
	id: string;
	name: string;
	description: string | null;
	location: string | null;
	controlClass: "SWITCH" | "DOOR";
	canControlOnline: boolean;
	canControlWithCode: boolean;
	currentState: boolean;
	isActive: boolean;
	provider: {
		id: number;
		name: string;
		providerType: string;
	};
	authorizedRoles: { id: number; name: string }[];
	authorizedUsers: { id: number; name: string; username: string }[];
};

function ControlPointsPage() {
	const { user } = useAuth();
	const queryClient = useQueryClient();
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

	const [activeFilter, setActiveFilter] = React.useState<
		"active" | "inactive" | "all"
	>("active");
	const [classFilter, setClassFilter] = React.useState<
		"SWITCH" | "DOOR" | "all"
	>("all");

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
			isActive: activeFilter === "all" ? undefined : activeFilter === "active",
			controlClass: classFilter === "all" ? undefined : classFilter,
		};
	}, [debouncedSearch, offset, pageSize, activeFilter, classFilter]);

	const {
		data = { points: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["control", "points", queryParams],
		queryFn: async () => await trpc.control.points.list.query(queryParams),
		retry: false,
	});

	const operateMutation = useMutation({
		mutationFn: async ({
			id,
			action,
		}: {
			id: string;
			action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
		}) => {
			return await trpc.control.points.operate.mutate({ id, action });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["control", "points"] });
			toast.success("Operation successful");
		},
		onError: (error) => {
			toast.error(error.message || "Operation failed");
		},
	});

	const canOperate = user && checkPermissions(user, ["control.points.operate"]);
	const canCreate = user && checkPermissions(user, ["control.points.create"]);
	const canUpdate = user && checkPermissions(user, ["control.points.update"]);
	const canDelete = user && checkPermissions(user, ["control.points.delete"]);

	// Get user's role IDs
	const userRoleIds = React.useMemo(() => {
		if (!user) return [];
		return ((user as { roles?: { id: number }[] }).roles ?? []).map(
			(r) => r.id,
		);
	}, [user]);

	// Check if user can operate a specific control point
	const canOperatePoint = React.useCallback(
		(point: ControlPoint) => {
			if (!canOperate) return false;

			// System users can operate everything
			if (user?.isSystemUser) return true;

			// If no restrictions, anyone with operate permission can use it
			if (
				point.authorizedRoles.length === 0 &&
				point.authorizedUsers.length === 0
			) {
				return true;
			}

			// Check if directly authorized
			if (user && point.authorizedUsers.some((u) => u.id === user.id)) {
				return true;
			}

			// Check if authorized through a role
			if (point.authorizedRoles.some((r) => userRoleIds.includes(r.id))) {
				return true;
			}

			return false;
		},
		[canOperate, user, userRoleIds],
	);

	const columns: ColumnDef<ControlPoint>[] = [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
		},
		{
			accessorKey: "location",
			header: "Location",
			cell: ({ row }) => row.original.location || "—",
		},
		{
			accessorKey: "controlClass",
			header: "Type",
			cell: ({ row }) => (
				<Badge variant="outline">
					{row.original.controlClass === "SWITCH" ? (
						<>
							<ToggleLeftIcon className="h-3 w-3 mr-1" />
							Switch
						</>
					) : (
						<>
							<DoorOpenIcon className="h-3 w-3 mr-1" />
							Door
						</>
					)}
				</Badge>
			),
		},
		{
			accessorKey: "currentState",
			header: "State",
			cell: ({ row }) => {
				if (row.original.controlClass === "DOOR") {
					return <span className="text-muted-foreground">—</span>;
				}
				return row.original.currentState ? (
					<Badge className="bg-green-500">
						<PowerIcon className="h-3 w-3 mr-1" />
						On
					</Badge>
				) : (
					<Badge variant="secondary">
						<PowerOffIcon className="h-3 w-3 mr-1" />
						Off
					</Badge>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const point = row.original;
				const isOperating = operateMutation.isPending;
				const canControl = canOperatePoint(point);

				// If user can't control or it's kiosk only, leave blank
				if (!point.canControlOnline || !canControl) {
					return null;
				}

				if (point.controlClass === "DOOR") {
					return (
						<Button
							size="sm"
							variant="outline"
							disabled={isOperating}
							onClick={() =>
								operateMutation.mutate({ id: point.id, action: "UNLOCK" })
							}
						>
							{isOperating ? (
								<Loader2Icon className="h-4 w-4 animate-spin" />
							) : (
								<DoorOpenIcon className="h-4 w-4 mr-1" />
							)}
							Unlock
						</Button>
					);
				}

				return point.currentState ? (
					<Button
						size="sm"
						variant="destructive"
						disabled={isOperating}
						onClick={() =>
							operateMutation.mutate({ id: point.id, action: "TURN_OFF" })
						}
					>
						{isOperating ? (
							<Loader2Icon className="h-4 w-4 animate-spin" />
						) : (
							<PowerOffIcon className="h-4 w-4 mr-1" />
						)}
						Turn Off
					</Button>
				) : (
					<Button
						size="sm"
						variant="default"
						disabled={isOperating}
						onClick={() =>
							operateMutation.mutate({ id: point.id, action: "TURN_ON" })
						}
					>
						{isOperating ? (
							<Loader2Icon className="h-4 w-4 animate-spin" />
						) : (
							<PowerIcon className="h-4 w-4 mr-1" />
						)}
						Turn On
					</Button>
				);
			},
		},
		// Edit/Delete column (no header)
		...(canUpdate || canDelete
			? [
					{
						id: "edit",
						header: "",
						cell: ({ row }: { row: { original: ControlPoint } }) => {
							const point = row.original;
							return (
								<div className="flex gap-1 justify-end">
									{point.canControlWithCode && (
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Copy control URL for ${point.name}`}
											onClick={() => {
												const url = `${window.location.origin}/control/${point.id}`;
												navigator.clipboard.writeText(url);
												toast.success("URL copied to clipboard");
											}}
										>
											<QrCodeIcon className="h-4 w-4 text-muted-foreground" />
										</Button>
									)}
									{canUpdate && <EditControlPointDialog point={point} />}
									{canDelete && <DeleteControlPointDialog point={point} />}
								</div>
							);
						},
					},
				]
			: []),
	];

	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.points.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Control Points</PageTitle>
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
					{canCreate && <CreateControlPointDialog />}
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
								placeholder="Search control points..."
							/>
						</TableSearchInput>
						<div className="flex items-center gap-2">
							<Select
								value={activeFilter}
								onValueChange={(value) => {
									setActiveFilter(value as "active" | "inactive" | "all");
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-[130px]">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={classFilter}
								onValueChange={(value) => {
									setClassFilter(value as "SWITCH" | "DOOR" | "all");
									resetToFirstPage();
								}}
							>
								<SelectTrigger className="w-[130px]">
									<SelectValue placeholder="Type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="SWITCH">Switch</SelectItem>
									<SelectItem value="DOOR">Door</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</TableToolbar>
					<DataTable
						columns={columns}
						data={data.points}
						isLoading={isLoading}
					/>
					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.points.length}
						total={data.total}
						itemName="control points"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}
