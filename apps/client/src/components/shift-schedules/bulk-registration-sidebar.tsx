import { CalendarCheck, CalendarDays, Info, MapPin, X } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ShiftSchedule } from "./shift-scheduler-utils";
import { DAYS_OF_WEEK, formatCompactTime } from "./shift-scheduler-utils";
import type { useShiftMutations } from "./use-shift-mutations";

interface BulkShiftType {
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
	/** Schedule IDs where this shift type has an available slot across all selected blocks */
	scheduleIds: number[];
	/** Total number of selected blocks where this type appears and is available */
	availableBlockCount: number;
	/** Total number of selected blocks */
	totalSelectedBlocks: number;
}

interface BulkRegistrationSidebarProps {
	selectedBlocks: Set<string>;
	blocks: Map<
		string,
		{ schedules: ShiftSchedule[]; total: number; available: number }
	>;
	isWithinSignupWindow: boolean;
	bulkRegisterMutation: ReturnType<
		typeof useShiftMutations
	>["bulkRegisterMutation"];
	onClearSelection: () => void;
	onExitBulkMode: () => void;
}

/**
 * Sidebar shown during bulk registration mode.
 * Displays shift types that have open slots across ALL selected time blocks,
 * allowing the user to register for a specific shift type at all selected slots at once.
 */
export function BulkRegistrationSidebar({
	selectedBlocks,
	blocks,
	isWithinSignupWindow,
	bulkRegisterMutation,
	onClearSelection,
	onExitBulkMode,
}: BulkRegistrationSidebarProps) {
	// Compute eligible shift types: those that have a registerable schedule at every selected block
	const bulkShiftTypes = useMemo(() => {
		if (selectedBlocks.size === 0) return [];

		const selectedBlockKeys = Array.from(selectedBlocks);

		// For each shift type, find which selected blocks have a registerable schedule
		const shiftTypeMap = new Map<
			number,
			{
				shiftTypeName: string;
				shiftTypeColor: string | null;
				shiftTypeLocation: string;
				scheduleIds: number[];
				availableBlockCount: number;
			}
		>();

		for (const blockKey of selectedBlockKeys) {
			const blockData = blocks.get(blockKey);
			if (!blockData) continue;

			for (const schedule of blockData.schedules) {
				if (!schedule.canRegister) continue;

				if (!shiftTypeMap.has(schedule.shiftTypeId)) {
					shiftTypeMap.set(schedule.shiftTypeId, {
						shiftTypeName: schedule.shiftTypeName,
						shiftTypeColor: schedule.shiftTypeColor,
						shiftTypeLocation: schedule.shiftTypeLocation,
						scheduleIds: [],
						availableBlockCount: 0,
					});
				}

				const entry = shiftTypeMap.get(schedule.shiftTypeId);
				if (!entry) continue;
				// Only add the schedule ID once (a schedule might span multiple blocks)
				if (!entry.scheduleIds.includes(schedule.id)) {
					entry.scheduleIds.push(schedule.id);
				}
				entry.availableBlockCount++;
			}
		}

		// Filter to only shift types available at ALL selected blocks
		const totalBlocks = selectedBlockKeys.length;
		const result: BulkShiftType[] = [];

		for (const [shiftTypeId, data] of shiftTypeMap) {
			if (data.availableBlockCount >= totalBlocks) {
				result.push({
					shiftTypeId,
					...data,
					totalSelectedBlocks: totalBlocks,
				});
			}
		}

		return result.sort((a, b) =>
			a.shiftTypeName.localeCompare(b.shiftTypeName),
		);
	}, [selectedBlocks, blocks]);

	// Format selected blocks for display
	const selectedBlockDetails = useMemo(() => {
		return Array.from(selectedBlocks)
			.map((key) => {
				const [dayStr, timeStr] = key.split("-");
				const dayOfWeek = Number.parseInt(dayStr, 10);
				const timeBlock = Number.parseInt(timeStr, 10);
				const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
				return {
					key,
					dayOfWeek,
					timeBlock,
					dayLabel: day?.short ?? `Day ${dayOfWeek}`,
					timeLabel: formatCompactTime(timeBlock),
				};
			})
			.sort((a, b) => {
				if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
				return a.timeBlock - b.timeBlock;
			});
	}, [selectedBlocks]);

	const handleBulkRegister = (scheduleIds: number[]) => {
		bulkRegisterMutation.mutate(scheduleIds, {
			onSuccess: () => {
				onClearSelection();
			},
		});
	};

	if (selectedBlocks.size === 0) {
		return (
			<div className="flex h-full flex-col">
				<div className="border-b bg-card p-4">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-semibold">Bulk Registration</h3>
						<Button
							variant="ghost"
							size="icon"
							onClick={onExitBulkMode}
							className="h-8 w-8"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Exit bulk mode</span>
						</Button>
					</div>
				</div>
				<div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
					<div>
						<CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-50" />
						<p className="text-sm">
							Click time slots on the grid to select them
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Click a slot again to deselect it
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b bg-card p-4">
				<div className="flex items-center justify-between mb-2">
					<h3 className="text-lg font-semibold">Bulk Registration</h3>
					<Button
						variant="ghost"
						size="icon"
						onClick={onExitBulkMode}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
						<span className="sr-only">Exit bulk mode</span>
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					{selectedBlocks.size} slot{selectedBlocks.size !== 1 ? "s" : ""}{" "}
					selected
				</p>
			</div>

			{/* Selected blocks summary */}
			<div className="border-b px-4 py-3">
				<div className="flex items-center justify-between mb-2">
					<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Selected Slots
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClearSelection}
						className="h-6 px-2 text-xs"
					>
						Clear all
					</Button>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{selectedBlockDetails.map((block) => (
						<Badge
							key={block.key}
							variant="secondary"
							className="text-xs gap-1"
						>
							{block.dayLabel} {block.timeLabel}
						</Badge>
					))}
				</div>
			</div>

			{/* Eligible shift types */}
			<div className="flex-1 overflow-y-auto p-4 pb-24">
				{!isWithinSignupWindow ? (
					<div className="flex flex-col items-center justify-center text-center py-8">
						<Info className="h-8 w-8 text-muted-foreground/50 mb-3" />
						<p className="text-sm text-muted-foreground">
							Registration is not currently open
						</p>
					</div>
				) : bulkShiftTypes.length === 0 ? (
					<div className="flex flex-col items-center justify-center text-center py-8">
						<CalendarCheck className="h-8 w-8 text-muted-foreground/50 mb-3" />
						<p className="text-sm font-medium mb-1">No shift types available</p>
						<p className="text-xs text-muted-foreground">
							No shift type has open, registerable slots at all selected time
							slots. Try selecting fewer or different slots.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-xs text-muted-foreground">
							These shift types have open slots at all selected time slots.
							Register to sign up for all of them at once.
						</p>
						{bulkShiftTypes.map((shiftType) => (
							<BulkShiftTypeCard
								key={shiftType.shiftTypeId}
								shiftType={shiftType}
								isPending={bulkRegisterMutation.isPending}
								onRegister={() => handleBulkRegister(shiftType.scheduleIds)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function BulkShiftTypeCard({
	shiftType,
	isPending,
	onRegister,
}: {
	shiftType: BulkShiftType;
	isPending: boolean;
	onRegister: () => void;
}) {
	return (
		<div className="rounded-xl border-2 border-green-500/50 bg-green-50/50 dark:bg-green-950/20 p-4 transition-all">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex items-center gap-2">
						{shiftType.shiftTypeColor && (
							<div
								className="h-3 w-3 rounded-full shadow-sm ring-2 ring-white dark:ring-gray-800"
								style={{ backgroundColor: shiftType.shiftTypeColor }}
							/>
						)}
						<h4 className="truncate font-semibold">
							{shiftType.shiftTypeName}
						</h4>
					</div>

					<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
						<span className="flex items-center gap-1">
							<MapPin className="h-3.5 w-3.5" />
							{shiftType.shiftTypeLocation}
						</span>
						<span className="flex items-center gap-1">
							<CalendarCheck className="h-3.5 w-3.5" />
							{shiftType.scheduleIds.length} shift
							{shiftType.scheduleIds.length !== 1 ? "s" : ""}
						</span>
					</div>
				</div>

				<Button
					size="sm"
					onClick={onRegister}
					disabled={isPending}
					className="rounded-lg bg-green-600 text-white hover:bg-green-700 shrink-0"
				>
					{isPending ? (
						<Spinner className="h-4 w-4" />
					) : (
						<>
							Register
							<Badge
								variant="secondary"
								className="ml-1.5 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] bg-white/20 text-white"
							>
								{shiftType.scheduleIds.length}
							</Badge>
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

/**
 * Empty state for the bulk sidebar before bulk mode is activated.
 */
export function BulkRegistrationSidebarEmpty() {
	return (
		<div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
			<div>
				<CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-50" />
				<p className="text-sm">Select a time slot to view details</p>
			</div>
		</div>
	);
}
