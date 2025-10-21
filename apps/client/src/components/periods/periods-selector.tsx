import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

interface PeriodsSelectorProps {
	currentPeriodId: number;
	onCreateNew: () => void;
}

export function PeriodsSelector({
	currentPeriodId,
	onCreateNew,
}: PeriodsSelectorProps) {
	const navigate = useNavigate();

	const { data: periodsData, isLoading } = useQuery({
		queryKey: ["periods", { limit: 100, offset: 0 }],
		queryFn: async () => {
			return trpc.periods.list.query({
				limit: 100,
				offset: 0,
			});
		},
	});

	const currentPeriod = periodsData?.periods?.find(
		(p) => p.id === currentPeriodId,
	);

	const handlePeriodChange = (periodId: number) => {
		navigate({
			to: "/app/periods/$periodId",
			params: { periodId: String(periodId) },
		});
	};

	if (isLoading) {
		return (
			<Button variant="outline" disabled className="min-w-[200px]">
				<Spinner className="mr-2 h-4 w-4" />
				Loading...
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="min-w-[200px] justify-between">
					<span className="truncate">
						{currentPeriod?.name || "Select Period"}
					</span>
					<ChevronDown className="ml-2 h-4 w-4 shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[200px]">
				<DropdownMenuLabel>Select Period</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{periodsData?.periods && periodsData.periods.length > 0 ? (
					periodsData.periods.map((period) => (
						<DropdownMenuItem
							key={period.id}
							onClick={() => handlePeriodChange(period.id)}
							className={
								period.id === currentPeriodId ? "bg-accent" : undefined
							}
						>
							{period.name}
						</DropdownMenuItem>
					))
				) : (
					<DropdownMenuItem disabled>No periods available</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onCreateNew}>
					<Plus className="mr-2 h-4 w-4" />
					Create New Period
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
