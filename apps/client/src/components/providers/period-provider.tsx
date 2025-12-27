import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

type PeriodContextValue = {
	period: number | null;
	setPeriod: (id: number | null) => void;
	loading: boolean;
};

const defaultValue: PeriodContextValue = {
	period: null,
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	setPeriod: () => {},
	loading: true,
};

export const PeriodContext = createContext<PeriodContextValue>(defaultValue);

export function PeriodProvider({ children }: { children: React.ReactNode }) {
	const [period, setPeriod] = useState<number | null>(null);

	// Fetch the server's current period and a visible list of periods so the
	// provider can deterministically choose a default without racing with the
	// selector component.
	const { data: currentPeriodData, isLoading: currentLoading } = useQuery({
		queryKey: ["currentPeriod"],
		queryFn: async () => trpc.periods.getCurrent.query(),
	});

	const { data: visiblePeriodsData, isLoading: visibleLoading } = useQuery({
		queryKey: ["periods", "listVisible", { limit: 100 }],
		queryFn: async () => trpc.periods.listVisible.query({ limit: 100 }),
	});

	// Decide and set a sensible default once initial data is available. We
	// only set the period when it's still null so we don't override any user
	// selection.
	useEffect(() => {
		if (period !== null) return;

		if (currentPeriodData?.period) {
			setPeriod(currentPeriodData.period.id);
			return;
		}

		// Fallback: if there are visible periods, choose the first one (the UI
		// list is ordered by start asc elsewhere). This ensures we have a chosen
		// period even when the server doesn't declare a current one.
		if (visiblePeriodsData?.periods?.length) {
			setPeriod(visiblePeriodsData.periods[0].id);
		}
	}, [currentPeriodData, visiblePeriodsData, period]);

	const loading = currentLoading || visibleLoading;

	const value: PeriodContextValue = {
		period,
		setPeriod,
		loading,
	};

	return (
		<PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
	);
}

// Helper hook for consumers
export function usePeriod() {
	return useContext(PeriodContext);
}
