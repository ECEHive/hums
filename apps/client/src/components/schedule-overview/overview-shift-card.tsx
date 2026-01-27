import { Clock, MapPin, User, Users } from "lucide-react";
import { formatTimeRange } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { OverviewSchedule } from "./overview-utils";

interface OverviewShiftCardProps {
	schedule: OverviewSchedule;
}

export function OverviewShiftCard({ schedule }: OverviewShiftCardProps) {
	const fillPercent =
		schedule.slots > 0
			? Math.round((schedule.filledSlots / schedule.slots) * 100)
			: 0;

	return (
		<div
			className={cn(
				"rounded-xl border-2 p-4 transition-all",
				schedule.filledSlots === schedule.slots
					? "border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-950/20"
					: schedule.filledSlots > 0
						? "border-muted-foreground/30 bg-muted/10"
						: "border-muted bg-muted/20",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					{/* Shift type header */}
					<div className="mb-2 flex items-center gap-2">
						{schedule.shiftTypeColor && (
							<div
								className="h-3 w-3 rounded-full shadow-sm ring-2 ring-white dark:ring-gray-800 shrink-0"
								style={{ backgroundColor: schedule.shiftTypeColor }}
							/>
						)}
						<h4 className="truncate font-semibold">{schedule.shiftTypeName}</h4>
					</div>

					{/* Time and location */}
					<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
						<span className="flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							{formatTimeRange(schedule.startTime, schedule.endTime)}
						</span>
						<span className="flex items-center gap-1">
							<MapPin className="h-3.5 w-3.5" />
							{schedule.shiftTypeLocation}
						</span>
					</div>

					{/* Slots visualization */}
					<div className="mt-3">
						<div className="mb-1.5 flex items-center gap-2">
							<Users className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								{schedule.filledSlots} / {schedule.slots} filled ({fillPercent}
								%)
							</span>
						</div>
						<div className="flex gap-1">
							{Array.from({ length: schedule.slots }, (_, i) => (
								<div
									key={i}
									className={cn(
										"h-2 max-w-8 flex-1 rounded-full transition-colors",
										i < schedule.filledSlots ? "bg-cyan-500/70" : "bg-muted/60",
									)}
								/>
							))}
						</div>
					</div>

					{/* Registered users list */}
					{schedule.users.length > 0 && (
						<div className="mt-3 space-y-1">
							<div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
								<User className="h-3 w-3" />
								Registered:
							</div>
							<div className="flex flex-wrap gap-1.5">
								{schedule.users.map((user) => (
									<span
										key={user.id}
										className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
									>
										{user.name}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Empty slots indicator */}
					{schedule.users.length === 0 && (
						<div className="mt-3 text-xs text-muted-foreground italic">
							No one registered yet
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
