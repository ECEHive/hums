import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { AuditLogApiTokenSelector } from "@/components/audit-logs/api-token-selector";
import { createAuditLogColumns } from "@/components/audit-logs/columns";
import { AuditLogDetailsSheet } from "@/components/audit-logs/details-sheet";
import type {
	AuditLogFilterApiToken,
	AuditLogFilterUser,
	AuditLogRow,
} from "@/components/audit-logs/types";
import { AuditLogUserSelector } from "@/components/audit-logs/user-selector";
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
	FilterField,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePersistedFilters } from "@/hooks/use-persisted-filters";
import { useDebounce } from "@/lib/debounce";
import { checkPermissions } from "@/lib/permissions";

export const permissions = ["audit_logs.list"];

export const Route = createFileRoute("/app/_app/audit-logs")({
	component: () =>
		RequirePermissions({
			permissions,
			forbiddenFallback: <MissingPermissions />,
			children: <AuditLogsPage />,
		}),
});

type FilterState = {
	source: "" | "trpc" | "rest" | "slack";
	actor: AuditLogFilterUser | null;
	impersonatedBy: AuditLogFilterUser | null;
	apiToken: AuditLogFilterApiToken | null;
	actionInput: string;
	page: number;
	pageSize: number;
};

const DEFAULT_FILTERS: FilterState = {
	source: "",
	actor: null,
	impersonatedBy: null,
	apiToken: null,
	actionInput: "",
	page: 1,
	pageSize: 20,
};

const _MAX_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

type AuditLogsListResponse = Awaited<
	ReturnType<typeof trpc.auditLogs.list.query>
>;

function AuditLogsPage() {
	const user = useCurrentUser();
	const canFilterUsers = useMemo(
		() => checkPermissions(user, ["users.list"]),
		[user],
	);
	const canFilterApiTokens = useMemo(
		() => checkPermissions(user, ["api_tokens.list"]),
		[user],
	);

	const { filters, setFilters, resetFilters } =
		usePersistedFilters<FilterState>({
			pageKey: "audit-logs",
			defaultFilters: DEFAULT_FILTERS,
		});

	// Extract values from filters with defaults
	const source = filters.source ?? DEFAULT_FILTERS.source;
	const actor = filters.actor ?? DEFAULT_FILTERS.actor;
	const impersonatedBy =
		filters.impersonatedBy ?? DEFAULT_FILTERS.impersonatedBy;
	const apiToken = filters.apiToken ?? DEFAULT_FILTERS.apiToken;
	const actionInput = filters.actionInput ?? DEFAULT_FILTERS.actionInput;
	const page = filters.page ?? DEFAULT_FILTERS.page;
	const pageSize = filters.pageSize ?? DEFAULT_FILTERS.pageSize;

	const debouncedAction = useDebounce(actionInput, 300);

	const setPage = useCallback(
		(newPage: number) => {
			setFilters((prev) => ({ ...prev, page: newPage }));
		},
		[setFilters],
	);

	const setPageSize = useCallback(
		(newSize: number) => {
			setFilters((prev) => ({ ...prev, pageSize: newSize, page: 1 }));
		},
		[setFilters],
	);

	const setActionInput = useCallback(
		(value: string) => {
			setFilters((prev) => ({ ...prev, actionInput: value, page: 1 }));
		},
		[setFilters],
	);

	useEffect(() => {
		if (canFilterUsers) return;
		setFilters((prev) => {
			if (!prev.actor && !prev.impersonatedBy) return prev;
			return { ...prev, actor: null, impersonatedBy: null };
		});
	}, [canFilterUsers, setFilters]);

	useEffect(() => {
		if (canFilterApiTokens) return;
		setFilters((prev) => {
			if (!prev.apiToken) return prev;
			return { ...prev, apiToken: null };
		});
	}, [canFilterApiTokens, setFilters]);
	const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
	const handleSelectLog = useCallback((log: AuditLogRow) => {
		setSelectedLog(log);
	}, []);

	const columns = useMemo(
		() =>
			createAuditLogColumns({
				onInspect: handleSelectLog,
			}),
		[handleSelectLog],
	);

	const queryInput = useMemo(() => {
		return {
			action: formValueToString(debouncedAction),
			userId: actor?.id,
			impersonatedById: impersonatedBy?.id,
			apiTokenId: apiToken?.id,
			source: source || undefined,
			limit: pageSize,
			page,
		};
	}, [
		debouncedAction,
		actor,
		impersonatedBy,
		apiToken,
		source,
		page,
		pageSize,
	]);

	const { data, isLoading, isFetching, refetch } =
		useQuery<AuditLogsListResponse>({
			queryKey: ["auditLogs", queryInput],
			queryFn: () => trpc.auditLogs.list.query(queryInput),
			staleTime: 5_000,
		});

	const logs = data?.logs ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(data?.totalPages ?? 1, 1);
	const resolvedPage = Math.min(data?.page ?? page, totalPages);
	const resolvedPageSize = data?.pageSize ?? pageSize;

	useEffect(() => {
		if (!data) return;
		const serverPage = data.page ?? 1;
		if (serverPage !== page) {
			setPage(serverPage);
		}
	}, [data, page]);

	const handlePageChange = useCallback(
		(nextPage: number) => {
			const clamped = Math.min(Math.max(nextPage, 1), totalPages);
			setPage(clamped);
		},
		[totalPages, setPage],
	);

	const handleActorChange = useCallback(
		(newActor: AuditLogFilterUser | null) => {
			setFilters((prev) => {
				if (prev.actor?.id === newActor?.id) return prev;
				return { ...prev, actor: newActor, page: 1 };
			});
		},
		[setFilters],
	);

	const handleImpersonatedByChange = useCallback(
		(newImpersonatedBy: AuditLogFilterUser | null) => {
			setFilters((prev) => {
				if (prev.impersonatedBy?.id === newImpersonatedBy?.id) return prev;
				return { ...prev, impersonatedBy: newImpersonatedBy, page: 1 };
			});
		},
		[setFilters],
	);

	const handleApiTokenChange = useCallback(
		(newApiToken: AuditLogFilterApiToken | null) => {
			setFilters((prev) => {
				if (prev.apiToken?.id === newApiToken?.id) return prev;
				return { ...prev, apiToken: newApiToken, page: 1 };
			});
		},
		[setFilters],
	);

	const handleSourceChange = useCallback(
		(newSource: FilterState["source"]) => {
			setFilters((prev) => {
				if (prev.source === newSource) return prev;
				return { ...prev, source: newSource, page: 1 };
			});
		},
		[setFilters],
	);

	const handleReset = useCallback(() => {
		resetFilters();
	}, [resetFilters]);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Audit Logs</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
				</PageActions>
			</PageHeader>

			<PageContent>
				{/* Audit Logs Table */}
				<Card>
					<CardHeader>
						<CardTitle>Audit Logs</CardTitle>
						<CardDescription>View and filter system audit logs</CardDescription>
					</CardHeader>
					<CardContent>
						<TableContainer>
							<TableToolbar>
								<TableSearchInput className="max-w-md">
									<Input
										placeholder="Search by action (e.g., users.create)..."
										value={actionInput}
										onChange={(event) => setActionInput(event.target.value)}
									/>
								</TableSearchInput>
								<TableFilters
									activeFiltersCount={
										(actor ? 1 : 0) +
										(impersonatedBy ? 1 : 0) +
										(apiToken ? 1 : 0) +
										(source ? 1 : 0)
									}
									hasActiveFilters={
										!!actor || !!impersonatedBy || !!apiToken || !!source
									}
									onReset={handleReset}
								>
									{canFilterUsers && (
										<>
											<FilterField label="Actor">
												<AuditLogUserSelector
													placeholder="Search by name"
													value={actor}
													onChange={handleActorChange}
												/>
											</FilterField>
											<FilterField label="Impersonated by">
												<AuditLogUserSelector
													placeholder="Search impersonators"
													value={impersonatedBy}
													onChange={handleImpersonatedByChange}
												/>
											</FilterField>
										</>
									)}
									{canFilterApiTokens && (
										<FilterField label="API token">
											<AuditLogApiTokenSelector
												placeholder="Search API tokens"
												value={apiToken}
												onChange={handleApiTokenChange}
											/>
										</FilterField>
									)}
									<FilterField label="Source">
										<Select
											value={source || "all"}
											onValueChange={(value) =>
												handleSourceChange(
													value === "all"
														? ""
														: (value as FilterState["source"]),
												)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="All sources" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All sources</SelectItem>
												<SelectItem value="trpc">TRPC</SelectItem>
												<SelectItem value="rest">REST</SelectItem>
												<SelectItem value="slack">Slack</SelectItem>
											</SelectContent>
										</Select>
									</FilterField>
								</TableFilters>
							</TableToolbar>
							<DataTable
								columns={columns}
								data={logs}
								isLoading={isLoading || isFetching}
								emptyMessage="No audit logs found"
								emptyDescription="Try adjusting your filters"
								onRowClick={handleSelectLog}
							/>

							{total > 0 && (
								<TablePaginationFooter
									page={resolvedPage}
									totalPages={totalPages}
									onPageChange={handlePageChange}
									offset={(resolvedPage - 1) * resolvedPageSize}
									currentCount={logs.length}
									total={total}
									itemName="audit logs"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										setPage(1);
									}}
									pageSizeOptions={PAGE_SIZE_OPTIONS}
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>

				<AuditLogDetailsSheet
					log={selectedLog}
					open={Boolean(selectedLog)}
					onOpenChange={(open) => {
						if (!open) setSelectedLog(null);
					}}
				/>
			</PageContent>
		</Page>
	);
}

function formValueToString(value: string) {
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}
