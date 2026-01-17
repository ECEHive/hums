import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import React, { useState } from "react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { CreatePeriodSheet } from "@/components/periods/create-period-sheet";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

interface PeriodSelectorProps {
	selectedPeriodId: number | null;
	onPeriodChange: (periodId: number) => void;
}

export function PeriodSelector({
	selectedPeriodId,
	onPeriodChange,
}: PeriodSelectorProps) {
	const user = useCurrentUser();
	// If user has the 'periods.list' permission they can list all periods.
	const canListAll = checkPermissions(user, ["periods.list"]);
	const canCreate = checkPermissions(user, ["periods.create"]);

	const { data: periodsData, isLoading } = useQuery({
		// Include permission in the cache key so queries don't collide.
		queryKey: ["periods", canListAll ? "list" : "listVisible", { limit: 100 }],
		queryFn: async () => {
			if (canListAll) {
				return trpc.periods.list.query({ limit: 100, offset: 0 });
			}
			return trpc.periods.listVisible.query({ limit: 100 });
		},
		// Disable refetch on window focus to prevent unnecessary re-renders
		// that could disrupt UI state (e.g., open dialogs)
		refetchOnWindowFocus: false,
	});

	const periods = periodsData?.periods ?? [];
	const [createOpen, setCreateOpen] = useState(false);

	// If the currently selected period isn't present in the fetched list
	// (for example when permissions/filtering differ), fetch that single
	// period so it can be displayed in the selector instead of leaving the
	// Select blank.
	const { data: selectedPeriodData, isLoading: selectedPeriodLoading } =
		useQuery({
			queryKey: ["periods", "get", selectedPeriodId ?? "none"],
			queryFn: async () => {
				if (selectedPeriodId === null) return null;
				return trpc.periods.get.query({ id: selectedPeriodId });
			},
			enabled:
				selectedPeriodId !== null &&
				!periods.some((p) => p.id === selectedPeriodId),
			// Disable refetch on window focus to prevent unnecessary re-renders
			// that could disrupt UI state (e.g., open dialogs)
			refetchOnWindowFocus: false,
		});

	// Build displayedPeriods: include the selected period (from a single fetch)
	// if it's missing from the primary list so the Select can render it.
	const displayedPeriods = React.useMemo(() => {
		if (selectedPeriodId === null) return periods;
		if (periods.some((p) => p.id === selectedPeriodId)) return periods;

		if (selectedPeriodData?.period)
			return [selectedPeriodData.period, ...periods];

		// Temporary placeholder while selected period is loading
		return [
			{
				id: selectedPeriodId,
				name: selectedPeriodLoading
					? "Loading..."
					: `Period ${selectedPeriodId}`,
			},
			...periods,
		];
	}, [periods, selectedPeriodId, selectedPeriodData, selectedPeriodLoading]);

	// Do not auto-select here — the PeriodProvider sets the default period
	// (server-provided) to avoid races between components.

	if (isLoading) {
		return (
			<div className="flex items-center gap-2">
				<Spinner className="w-4 h-4" />
				<span className="text-sm text-muted-foreground">
					Loading periods...
				</span>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-3">
			<Select
				value={selectedPeriodId?.toString() ?? ""}
				onValueChange={(value) => onPeriodChange(Number.parseInt(value, 10))}
			>
				<SelectTrigger className="w-full overflow-hidden text-ellipsis">
					<SelectValue placeholder="Select a period" />
				</SelectTrigger>
				<SelectContent>
					{displayedPeriods.map((period) => (
						<SelectItem key={period.id} value={period.id.toString()}>
							<div className="flex flex-col items-start">
								<span className="font-medium">{period.name}</span>
							</div>
						</SelectItem>
					))}
					{displayedPeriods.length === 0 && (
						<div className="p-4 text-sm text-muted-foreground">
							No periods available.
						</div>
					)}
				</SelectContent>
			</Select>
			{canCreate && (
				<>
					<Button
						variant="outline"
						onClick={() => setCreateOpen(true)}
						aria-label="Create Period"
					>
						<Plus className="w-4 h-4" />
					</Button>
					<CreatePeriodSheet open={createOpen} onOpenChange={setCreateOpen} />
				</>
			)}
		</div>
	);
}
