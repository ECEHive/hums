import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Calendar,
	Filter,
	Loader2,
	Printer,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { RequirePermissions } from "@/components/guards/require-permissions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import {
	type ShiftType,
	ShiftTypeMultiselect,
} from "@/components/shift-types/shift-type-multiselect";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/export")({
	component: () => (
		<RequirePermissions permissions={permissions}>
			<ExportSchedulesPage />
		</RequirePermissions>
	),
});

export const permissions = {
	all: ["shift_schedules.list", "shift_types.list"],
} as RequiredPermissions;

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "Sun" },
	{ value: 1, label: "Monday", short: "Mon" },
	{ value: 2, label: "Tuesday", short: "Tue" },
	{ value: 3, label: "Wednesday", short: "Wed" },
	{ value: 4, label: "Thursday", short: "Thu" },
	{ value: 5, label: "Friday", short: "Fri" },
	{ value: 6, label: "Saturday", short: "Sat" },
];

function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const period = hours >= 12 ? "PM" : "AM";
	const hours12 = hours % 12 || 12;
	if (minutes === 0) {
		return `${hours12}${period}`;
	}
	return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
}

function ExportSchedulesPage() {
	const { period: selectedPeriodId } = usePeriod();
	const currentUser = useCurrentUser();

	// State for filters
	const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>([]);
	const [selectedDays, setSelectedDays] = useState<number[]>([
		0, 1, 2, 3, 4, 5, 6,
	]);

	// Check if user has required permissions
	const hasPermissions = checkPermissions(currentUser, permissions);

	// Extract shift type IDs for the query
	const selectedShiftTypeIds = selectedShiftTypes.map((st) => st.id);

	// Fetch export data when period is selected
	const {
		data: exportData,
		isLoading: exportLoading,
		error: exportError,
	} = useQuery({
		queryKey: [
			"shiftSchedules",
			"listForExport",
			selectedPeriodId,
			selectedShiftTypeIds,
			selectedDays,
		],
		queryFn: () => {
			if (selectedPeriodId === null) {
				throw new Error("Period ID is required");
			}
			return trpc.shiftSchedules.listForExport.query({
				periodId: selectedPeriodId,
				shiftTypeIds:
					selectedShiftTypeIds.length > 0 ? selectedShiftTypeIds : undefined,
				daysOfWeek: selectedDays.length < 7 ? selectedDays : undefined,
			});
		},
		enabled: hasPermissions && selectedPeriodId !== null,
	});

	// Get unique time slots and organize data for the table
	const tableData = useMemo(() => {
		if (!exportData) return null;

		const { schedules, shiftTypes } = exportData;

		// Get the shift types to display (either selected ones or all)
		const displayShiftTypes =
			selectedShiftTypeIds.length > 0
				? shiftTypes.filter((st) => selectedShiftTypeIds.includes(st.id))
				: shiftTypes;

		// Group schedules by day and time
		const timeSlotMap = new Map<
			string,
			Map<number, { users: { id: number; name: string }[] }>
		>();

		for (const schedule of schedules) {
			const dayLabel = DAYS_OF_WEEK.find(
				(d) => d.value === schedule.dayOfWeek,
			)?.short;
			const timeKey = `${dayLabel} ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)}`;

			if (!timeSlotMap.has(timeKey)) {
				timeSlotMap.set(timeKey, new Map());
			}

			const shiftTypeMap = timeSlotMap.get(timeKey);
			if (shiftTypeMap) {
				if (!shiftTypeMap.has(schedule.shiftType.id)) {
					shiftTypeMap.set(schedule.shiftType.id, { users: [] });
				}

				const entry = shiftTypeMap.get(schedule.shiftType.id);
				if (entry) {
					entry.users.push(...schedule.users);
				}
			}
		}

		// Sort time slots by day and time
		const sortedTimeSlots = Array.from(timeSlotMap.keys()).sort((a, b) => {
			const dayA = DAYS_OF_WEEK.findIndex((d) => a.startsWith(d.short));
			const dayB = DAYS_OF_WEEK.findIndex((d) => b.startsWith(d.short));
			if (dayA !== dayB) return dayA - dayB;
			return a.localeCompare(b);
		});

		return {
			shiftTypes: displayShiftTypes,
			timeSlots: sortedTimeSlots,
			data: timeSlotMap,
		};
	}, [exportData, selectedShiftTypeIds]);

	// Handle print - open new window with table content
	const handlePrint = useCallback(() => {
		if (!tableData || !exportData) return;

		// Generate HTML content for print window
		const printContent = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Shift Schedule - ${exportData.period.name}</title>
	<style>
		@page {
			size: letter portrait;
			margin: 0.5in;
		}
		
		body {
			margin: 0;
			padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			color: #000;
			background: #fff;
		}
		
		.header {
			margin-bottom: 16px;
		}
		
		.title {
			font-size: 16pt;
			font-weight: bold;
			margin-bottom: 4px;
			color: #000;
		}
		
		.subtitle {
			font-size: 10pt;
			color: #666;
		}
		
		table {
			width: 100%;
			border-collapse: collapse;
			font-size: 10pt;
			table-layout: auto;
		}
		
		th, td {
			border: 1px solid #333;
			padding: 2px 4px;
			text-align: left;
			vertical-align: top;
		}
		
		th {
			background-color: #e5e5e5;
			font-weight: bold;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		
		th:first-child, td:first-child {
			width: 100px;
			white-space: nowrap;
		}
		
		tbody tr:nth-child(even) td {
			background-color: #f5f5f5;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		
		.location {
			display: block;
			font-size: 8pt;
			font-weight: normal;
			color: #666;
		}
		
		.user-name {
			font-size: 9pt;
			color: #000;
		}
		
		.empty-cell {
			font-size: 8pt;
			color: #999;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="title">Shift Schedule - ${exportData.period.name}</div>
		<div class="subtitle">Generated on ${new Date().toLocaleString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		})}</div>
	</div>
	
	<table>
		<thead>
			<tr>
				<th>Day &amp; Time</th>
				${tableData.shiftTypes
					.map(
						(st) =>
							`<th>${st.name}${st.location ? `<span class="location">${st.location}</span>` : ""}</th>`,
					)
					.join("")}
			</tr>
		</thead>
		<tbody>
			${tableData.timeSlots
				.map(
					(timeSlot) => `
				<tr>
					<td>${timeSlot}</td>
					${tableData.shiftTypes
						.map((st) => {
							const users =
								tableData.data.get(timeSlot)?.get(st.id)?.users ?? [];
							if (users.length > 0) {
								return `<td>${users.map((u) => `<div class="user-name">${u.name}</div>`).join("")}</td>`;
							}
							return '<td><span class="empty-cell">—</span></td>';
						})
						.join("")}
				</tr>
			`,
				)
				.join("")}
		</tbody>
	</table>
	
	<script>
		window.onload = function() {
			window.print();
			window.onafterprint = function() {
				window.close();
			};
		};
	</script>
</body>
</html>
		`;

		// Open new window and write content
		const printWindow = window.open("", "_blank");
		if (printWindow) {
			printWindow.document.write(printContent);
			printWindow.document.close();
		}
	}, [tableData, exportData]);

	// Toggle day selection
	const toggleDay = useCallback((day: number) => {
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	}, []);

	// No period selected
	if (selectedPeriodId === null) {
		return (
			<Page>
				<PageHeader>
					<div>
						<PageTitle>Export Shift Schedules</PageTitle>
						<PageDescription>
							Generate a printable PDF of user shift assignments
						</PageDescription>
					</div>
				</PageHeader>
				<PageContent>
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12">
							<Calendar className="h-12 w-12 text-muted-foreground mb-4" />
							<p className="text-muted-foreground text-center">
								Please select a period from the sidebar to export shift
								schedules
							</p>
						</CardContent>
					</Card>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>Export Shift Schedules</PageTitle>
					<PageDescription>
						Generate a printable PDF of user shift assignments
					</PageDescription>
				</div>
			</PageHeader>

			<PageContent>
				{/* Filters Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Filter className="h-4 w-4" />
							Export Options
						</CardTitle>
						<CardDescription>
							Select the shift types and days to include in the export
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Shift Type Selection */}
						<div className="space-y-2">
							<Label>Shift Types</Label>
							<ShiftTypeMultiselect
								periodId={selectedPeriodId}
								value={selectedShiftTypes}
								onChange={setSelectedShiftTypes}
								placeholder="All shift types (click to filter)"
							/>
							<p className="text-sm text-muted-foreground">
								{selectedShiftTypes.length === 0
									? "All shift types will be included"
									: `${selectedShiftTypes.length} shift type${selectedShiftTypes.length === 1 ? "" : "s"} selected`}
							</p>
						</div>

						{/* Day Selection */}
						<div className="space-y-3">
							<Label>Days of Week</Label>
							<div className="flex flex-wrap gap-3">
								{DAYS_OF_WEEK.map((day) => (
									<div key={day.value} className="flex items-center space-x-2">
										<Checkbox
											id={`day-${day.value}`}
											checked={selectedDays.includes(day.value)}
											onCheckedChange={() => toggleDay(day.value)}
										/>
										<Label
											htmlFor={`day-${day.value}`}
											className="text-sm font-normal cursor-pointer"
										>
											{day.label}
										</Label>
									</div>
								))}
							</div>
						</div>

						{/* Export Button */}
						<div className="flex gap-3 pt-4 border-t">
							<Button
								onClick={handlePrint}
								disabled={exportLoading || !tableData}
								className="gap-2"
							>
								{exportLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Printer className="h-4 w-4" />
								)}
								Print / Save as PDF
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Error State */}
				{exportError && (
					<Card className="border-destructive">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-destructive">
								<AlertTriangle className="h-5 w-5" />
								Error Loading Data
							</CardTitle>
							<CardDescription>
								{exportError.message ||
									"Unable to load shift schedule data. Please try again."}
							</CardDescription>
						</CardHeader>
					</Card>
				)}

				{/* Summary Info */}
				{!exportLoading && tableData && (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Calendar className="h-4 w-4" />
								Export Summary
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2 text-sm">
								<p>
									<span className="font-medium">Period:</span>{" "}
									{exportData?.period.name}
								</p>
								<p>
									<span className="font-medium">Shift Types:</span>{" "}
									{selectedShiftTypes.length === 0
										? `All (${tableData.shiftTypes.length})`
										: selectedShiftTypes.length}
								</p>
								<p>
									<span className="font-medium">Days:</span>{" "}
									{selectedDays.length === 7
										? "All days"
										: `${selectedDays.length} day(s)`}
								</p>
								<p>
									<span className="font-medium">Time Slots:</span>{" "}
									{tableData.timeSlots.length}
								</p>
								{tableData.timeSlots.length === 0 && (
									<p className="text-muted-foreground pt-2">
										No schedules found for the selected filters.
									</p>
								)}
							</div>
						</CardContent>
					</Card>
				)}
			</PageContent>
		</Page>
	);
}
