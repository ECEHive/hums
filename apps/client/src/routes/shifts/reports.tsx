import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, NotebookTextIcon } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import DateRangeSelector from "@/components/date-range-selector";
import { MissingPermissions } from "@/components/missing-permissions";
import { DataTable } from "@/components/reports/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/shifts/reports")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Reports />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["users.list"];

function Reports() {
	const [start, setStart] = React.useState<Date | null>(null);
	const [end, setEnd] = React.useState<Date | null>(null);
	const [selectedRange, setSelectedRange] = React.useState<string>("");
	const [selectedPeriodId, setSelectedPeriodId] = React.useState<number | null>(
		null,
	)

	const { data: periodsData, isLoading } = useQuery({
		queryKey: ["periods", { limit: 100, offset: 0 }],
		queryFn: async () => {
			return trpc.periods.list.query({
				limit: 100,
				offset: 0,
			})
		},
	})

	return (
		<div className="p-6 inline-block w-full space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<NotebookTextIcon className="h-5 w-5" />
							Report Parameters
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="inline-flex flex-col w-max gap-4">
						<div>
							<div className="text-sm font-medium mb-3">Preset Date Ranges</div>
							{/* Buttons for common date ranges (last full 2 weeks, last full month, full period) */}
							<div className="flex flex-wrap gap-2">
								<ToggleGroup
									variant="outline"
									type="single"
									value={selectedRange}
									aria-label="Date Ranges"
								>
									<ToggleGroupItem
										value="last2weeks"
										onClick={() => {
											// Calculate last 2 full weeks
											const now = new Date()
											const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
											const lastSunday = new Date(
												now.getFullYear(),
												now.getMonth(),
												now.getDate() - dayOfWeek,
											)
											const startOfLast2Weeks = new Date(
												lastSunday.getFullYear(),
												lastSunday.getMonth(),
												lastSunday.getDate() - 14,
											)
											setStart(startOfLast2Weeks)
											setEnd(
												new Date(
													lastSunday.getFullYear(),
													lastSunday.getMonth(),
													lastSunday.getDate() - 1,
												),
											)
											setSelectedRange("last2weeks")
										}}
									>
										Last 2 Full Weeks
									</ToggleGroupItem>
									<ToggleGroupItem
										value="lastmonth"
										onClick={() => {
											const now = new Date()
											const lastDayOfLastMonth = new Date(
												now.getFullYear(),
												now.getMonth(),
												0,
											)
											const firstDayOfLastMonth = new Date(
												now.getFullYear(),
												now.getMonth() - 1,
												1,
											)
											setStart(firstDayOfLastMonth)
											setEnd(lastDayOfLastMonth)
											setSelectedRange("lastmonth")
										}}
									>
										Last Full Month
									</ToggleGroupItem>
									<ToggleGroupItem
										value="fullperiod"
										onClick={() => {
											setSelectedRange("fullperiod")
										}}
									>
										{isLoading ? (
											<Spinner className="mr-2 h-4 w-4" />
										) : (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<div className="flex items-center">
														<span className="px-3 py-1 inline-block">
															{selectedPeriodId &&
															selectedRange === "fullperiod"
																? periodsData?.periods.find(
																		(p) => p.id === selectedPeriodId,
																	)?.name
																: "Full Period"}
														</span>
														<ChevronDown className="ml-2 h-4 w-4 shrink-0" />
													</div>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start">
													{periodsData?.periods &&
													periodsData.periods.length > 0 ? (
														periodsData.periods.map((period) => (
															<DropdownMenuItem
																key={period.id}
																onClick={() => {
																	setSelectedPeriodId(period.id)
																	setStart(new Date(period.start))
																	setEnd(new Date(period.end))
																	setSelectedRange("fullperiod")
																}}
																className={
																	period.id === selectedPeriodId
																		? "bg-accent"
																		: undefined
																}
															>
																{period.name}
															</DropdownMenuItem>
														))
													) : (
														<DropdownMenuItem disabled>
															No periods available
														</DropdownMenuItem>
													)}
												</DropdownMenuContent>
											</DropdownMenu>
										)}
									</ToggleGroupItem>
								</ToggleGroup>
							</div>
						</div>
						<div>
							<DateRangeSelector
								value={[start ?? undefined, end ?? undefined]}
								onChange={([s, e]) => {
									setStart(s ?? null)
									setEnd(e ?? null)
									setSelectedRange("custom")
								}}
								withTime={false}
								label={"Custom Date Range"}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
			<DataTable columns={[]} data={[]} isLoading={false} />
		</div>
	)
}
