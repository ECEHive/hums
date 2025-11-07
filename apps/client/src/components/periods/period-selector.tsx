import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

interface PeriodSelectorProps {
	selectedPeriodId: number | null;
	onPeriodChange: (periodId: number) => void;
}

export function PeriodSelector({
	selectedPeriodId,
	onPeriodChange,
}: PeriodSelectorProps) {
	const { data: periodsData, isLoading } = useQuery({
		queryKey: ["periods", "all"],
		queryFn: async () => {
			return trpc.periods.list.query({ limit: 100 });
		},
	});

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

	const periods = periodsData?.periods ?? [];

	if (periods.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">No periods available</div>
		);
	}

	return (
		<div className="flex items-center gap-3">
			<CalendarIcon className="w-5 h-5 text-muted-foreground" />
			<Select
				value={selectedPeriodId?.toString() ?? ""}
				onValueChange={(value) => onPeriodChange(Number.parseInt(value, 10))}
			>
				<SelectTrigger className="w-[300px]">
					<SelectValue placeholder="Select a period" />
				</SelectTrigger>
				<SelectContent>
					{periods.map((period) => (
						<SelectItem key={period.id} value={period.id.toString()}>
							<div className="flex flex-col items-start">
								<span className="font-medium">{period.name}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
