import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon } from "lucide-react";
import { trpc } from "node_modules/@ecehive/trpc/client/trpc";
import React from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "../ui/spinner";

type Period = {
	id: number;
	name: string;
	start: Date;
	end: Date;
	visibleStart: Date | null;
	visibleEnd: Date | null;
	scheduleSignupStart: Date | null;
	scheduleSignupEnd: Date | null;
	scheduleModifyStart: Date | null;
	scheduleModifyEnd: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export function PeriodsDropdown() {
	const [, setSelectedPeriod] = React.useState<Period | null>(null);

	const { data = { periods: [] }, isLoading } = useQuery({
		queryKey: ["periods"],
		queryFn: async () => {
			const res = await trpc.periods.list.query({});
			console.log(res);
			return res;
		},
		retry: false,
	});

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				{isLoading ? (
					<Button variant="outline" disabled>
						<Spinner />
					</Button>
				) : data.periods.length > 0 ? (
					<Button variant="outline">
						{data.periods[0].name}
						<ChevronDownIcon />
					</Button>
				) : (
					<Button variant="outline" disabled>
						No existing periods
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="start">
				<DropdownMenuLabel>Shift Periods</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					{data.periods.map((period) => (
						<DropdownMenuItem
							key={period.id}
							onClick={() => setSelectedPeriod(period)}
						>
							{period.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
