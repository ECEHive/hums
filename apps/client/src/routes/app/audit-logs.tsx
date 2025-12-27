import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FilterIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import type { ReactNode } from "react";
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
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
} from "@/components/layout";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	DataTable,
	PageSizeSelect,
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
import { useDebounce } from "@/lib/debounce";
import { checkPermissions } from "@/lib/permissions";

export const permissions = ["audit_logs.list"];

export const Route = createFileRoute("/app/audit-logs")({
	component: () =>
		RequirePermissions({
			permissions,
			forbiddenFallback: <MissingPermissions />,
			children: <AuditLogsPage />,
		}),
});

type FilterState = {
	source: "" | "trpc" | "rest";
	actor: AuditLogFilterUser | null;
	impersonatedBy: AuditLogFilterUser | null;
	apiToken: AuditLogFilterApiToken | null;
};

const createDefaultFilters = (): FilterState => ({
	source: "",
	actor: null,
	impersonatedBy: null,
	apiToken: null,
});

const DEFAULT_PAGE_SIZE = 20;
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

	const [filters, setFilters] = useState<FilterState>(() =>
		createDefaultFilters(),
	);
	const [actionInput, setActionInput] = useState<string>("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const debouncedAction = useDebounce(actionInput, 300);

	useEffect(() => {
		setPage(1);
	}, [debouncedAction]);

	useEffect(() => {
		if (canFilterUsers) return;
		let changed = false;
		setFilters((prev) => {
			if (!prev.actor && !prev.impersonatedBy) return prev;
			changed = true;
			return { ...prev, actor: null, impersonatedBy: null };
		});
		if (changed) setPage(1);
	}, [canFilterUsers]);

	useEffect(() => {
		if (canFilterApiTokens) return;
		let changed = false;
		setFilters((prev) => {
			if (!prev.apiToken) return prev;
			changed = true;
			return { ...prev, apiToken: null };
		});
		if (changed) setPage(1);
	}, [canFilterApiTokens]);
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
			userId: filters.actor?.id,
			impersonatedById: filters.impersonatedBy?.id,
			apiTokenId: filters.apiToken?.id,
			source: filters.source || undefined,
			limit: pageSize,
			page,
		};
	}, [debouncedAction, filters, page, pageSize]);

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
			setPage((prev) => {
				const clamped = Math.min(Math.max(nextPage, 1), totalPages);
				return prev === clamped ? prev : clamped;
			});
		},
		[totalPages],
	);

	const handleActorChange = (actor: AuditLogFilterUser | null) => {
		let changed = false;
		setFilters((prev) => {
			if (prev.actor?.id === actor?.id) return prev;
			changed = true;
			return { ...prev, actor };
		});
		if (changed) setPage(1);
	};

	const handleImpersonatedByChange = (
		impersonatedBy: AuditLogFilterUser | null,
	) => {
		let changed = false;
		setFilters((prev) => {
			if (prev.impersonatedBy?.id === impersonatedBy?.id) return prev;
			changed = true;
			return { ...prev, impersonatedBy };
		});
		if (changed) setPage(1);
	};

	const handleApiTokenChange = (apiToken: AuditLogFilterApiToken | null) => {
		let changed = false;
		setFilters((prev) => {
			if (prev.apiToken?.id === apiToken?.id) return prev;
			changed = true;
			return { ...prev, apiToken };
		});
		if (changed) setPage(1);
	};

	const handleSourceChange = (source: FilterState["source"]) => {
		let changed = false;
		setFilters((prev) => {
			if (prev.source === source) return prev;
			changed = true;
			return { ...prev, source };
		});
		if (changed) setPage(1);
	};

	const handleReset = () => {
		const resetState = createDefaultFilters();
		setFilters(resetState);
		setActionInput("");
		setPage(1);
	};

	return (
		<Page>
			<PageHeader>
				<PageTitle>Audit Logs</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="mr-2 size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="mr-2 size-4" />
						)}
						Refresh
					</Button>
				</PageActions>
			</PageHeader>

			<PageContent>
				{/* Filters Card */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FilterIcon className="size-4" />
							<CardTitle>Filters</CardTitle>
						</div>
						<CardDescription>
							Filter audit logs by action, actor, token, and source
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
							<FilterField label="Action">
								<Input
									placeholder="users.create"
									value={actionInput}
									onChange={(event) => setActionInput(event.target.value)}
								/>
							</FilterField>
							{canFilterUsers ? (
								<>
									<FilterField label="Actor">
										<AuditLogUserSelector
											placeholder="Search by name"
											value={filters.actor}
											onChange={handleActorChange}
										/>
									</FilterField>
									<FilterField label="Impersonated by">
										<AuditLogUserSelector
											placeholder="Search impersonators"
											value={filters.impersonatedBy}
											onChange={handleImpersonatedByChange}
										/>
									</FilterField>
								</>
							) : null}
							{canFilterApiTokens ? (
								<FilterField label="API token">
									<AuditLogApiTokenSelector
										placeholder="Search API tokens"
										value={filters.apiToken}
										onChange={handleApiTokenChange}
									/>
								</FilterField>
							) : null}
							<FilterField label="Source">
								<Select
									value={filters.source || undefined}
									onValueChange={(value) =>
										handleSourceChange(value as FilterState["source"])
									}
								>
									<SelectTrigger className="w-full justify-between">
										<SelectValue placeholder="All sources" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="trpc">TRPC</SelectItem>
										<SelectItem value="rest">REST</SelectItem>
									</SelectContent>
								</Select>
							</FilterField>
						</div>
						<div className="mt-4">
							<Button type="button" variant="outline" onClick={handleReset}>
								Reset
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Audit Logs Table */}
				<TableContainer>
					<div className="flex items-center justify-between px-1 py-2">
						<PageSizeSelect
							pageSize={pageSize}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
						/>
					</div>

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
						/>
					)}
				</TableContainer>

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

function FilterField({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2 text-sm font-medium text-foreground">
			<span className="text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

function formValueToString(value: string) {
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}
