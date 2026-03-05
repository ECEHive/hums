import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronDownIcon,
	ChevronRightIcon,
	Loader2Icon,
	Plus,
	RefreshCcwIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/booking/availability")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AvailabilityPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

const permissions = {
	any: ["scheduling.availability.list"],
} as RequiredPermissions;

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

type AvailabilityEntry = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

function AvailabilityPage() {
	const queryClient = useQueryClient();
	const [selectedUserId, setSelectedUserId] = React.useState<string>("");

	const { data: usersData } = useQuery({
		queryKey: ["users", "list-for-availability"],
		queryFn: () => trpc.users.list.query({ limit: 500 }),
	});

	const userId = selectedUserId ? Number(selectedUserId) : undefined;

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["scheduling", "availability", userId],
		queryFn: () =>
			trpc.schedulerAvailability.list.query({ userId, limit: 500 }),
		enabled: true,
	});

	const [entries, setEntries] = React.useState<AvailabilityEntry[]>([]);
	const [isDirty, setIsDirty] = React.useState(false);

	React.useEffect(() => {
		if (data?.availabilities) {
			setEntries(
				data.availabilities.map(
					(a: { dayOfWeek: number; startTime: string; endTime: string }) => ({
						dayOfWeek: a.dayOfWeek,
						startTime: a.startTime,
						endTime: a.endTime,
					}),
				),
			);
			setIsDirty(false);
		}
	}, [data]);

	const saveMutation = useMutation({
		mutationFn: (input: {
			userId: number;
			availabilities: AvailabilityEntry[];
		}) => trpc.schedulerAvailability.bulkSet.mutate(input),
		onSuccess: () => {
			toast.success("Availability saved");
			setIsDirty(false);
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "availability"],
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to save availability");
		},
	});

	function addEntry(dayOfWeek: number) {
		setEntries([
			...entries,
			{ dayOfWeek, startTime: "09:00", endTime: "17:00" },
		]);
		setIsDirty(true);
	}

	function removeEntry(index: number) {
		setEntries(entries.filter((_, i) => i !== index));
		setIsDirty(true);
	}

	function updateEntry(
		index: number,
		field: keyof AvailabilityEntry,
		value: string | number,
	) {
		const updated = [...entries];
		updated[index] = { ...updated[index], [field]: value };
		setEntries(updated);
		setIsDirty(true);
	}

	function handleSave() {
		if (!userId) {
			toast.error("Please select a user");
			return;
		}
		saveMutation.mutate({ userId, availabilities: entries });
	}

	// Group entries by day
	const entriesByDay = React.useMemo(() => {
		const map = new Map<
			number,
			{ entry: AvailabilityEntry; index: number }[]
		>();
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const existing = map.get(entry.dayOfWeek) ?? [];
			existing.push({ entry, index: i });
			map.set(entry.dayOfWeek, existing);
		}
		return map;
	}, [entries]);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Scheduler Availability</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
				</PageActions>
			</PageHeader>
			<PageContent>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Select User</CardTitle>
						</CardHeader>
						<CardContent>
							<Select value={selectedUserId} onValueChange={setSelectedUserId}>
								<SelectTrigger className="w-[300px]">
									<SelectValue placeholder="Select a user..." />
								</SelectTrigger>
								<SelectContent>
									{usersData?.users?.map(
										(u: { id: number; name: string; username: string }) => (
											<SelectItem key={u.id} value={u.id.toString()}>
												{u.name} ({u.username})
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</CardContent>
					</Card>

					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Spinner />
						</div>
					) : (
						<AvailabilityDayEditor
							entriesByDay={entriesByDay}
							onAdd={addEntry}
							onRemove={removeEntry}
							onUpdate={updateEntry}
						/>
					)}

					{userId && isDirty && (
						<div className="flex items-center gap-3">
							<Button onClick={handleSave} disabled={saveMutation.isPending}>
								{saveMutation.isPending ? (
									<>
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									"Save Changes"
								)}
							</Button>
							<Badge variant="outline">Unsaved changes</Badge>
						</div>
					)}
				</div>
			</PageContent>
		</Page>
	);
}

/**
 * Shared component for day-based availability editing.
 */
export function AvailabilityDayEditor({
	entriesByDay,
	onAdd,
	onRemove,
	onUpdate,
}: {
	entriesByDay: Map<number, { entry: AvailabilityEntry; index: number }[]>;
	onAdd: (dayOfWeek: number) => void;
	onRemove: (index: number) => void;
	onUpdate: (
		index: number,
		field: keyof AvailabilityEntry,
		value: string | number,
	) => void;
}) {
	return (
		<div className="space-y-2">
			{DAY_NAMES.map((dayName, dayIndex) => {
				const dayEntries = entriesByDay.get(dayIndex) ?? [];
				return (
					<DaySection
						key={dayIndex}
						dayName={dayName}
						entries={dayEntries}
						onAdd={() => onAdd(dayIndex)}
						onRemove={onRemove}
						onUpdate={onUpdate}
					/>
				);
			})}
		</div>
	);
}

function DaySection({
	dayName,
	entries,
	onAdd,
	onRemove,
	onUpdate,
}: {
	dayName: string;
	entries: { entry: AvailabilityEntry; index: number }[];
	onAdd: () => void;
	onRemove: (index: number) => void;
	onUpdate: (
		index: number,
		field: keyof AvailabilityEntry,
		value: string | number,
	) => void;
}) {
	const [open, setOpen] = React.useState(entries.length > 0);

	// Open when entries are added
	React.useEffect(() => {
		if (entries.length > 0) setOpen(true);
	}, [entries.length]);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<Card className="gap-0 py-0">
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors"
					>
						<div className="flex items-center gap-3">
							{open ? (
								<ChevronDownIcon className="h-4 w-4" />
							) : (
								<ChevronRightIcon className="h-4 w-4" />
							)}
							<span className="font-medium">{dayName}</span>
							{entries.length > 0 && (
								<Badge variant="secondary" className="text-xs">
									{entries.length} window{entries.length > 1 ? "s" : ""}
								</Badge>
							)}
						</div>
						{entries.length === 0 && (
							<span className="text-muted-foreground text-sm">
								No availability
							</span>
						)}
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="border-t px-4 pb-3 pt-2.5">
						{entries.length === 0 ? (
							<p className="text-muted-foreground mb-3 text-sm">
								No time windows set for {dayName}.
							</p>
						) : (
							<div className="mb-3 space-y-2">
								{entries.map(({ entry, index }) => (
									<div key={index} className="flex items-center gap-3">
										<Input
											type="time"
											value={entry.startTime}
											onChange={(e) =>
												onUpdate(index, "startTime", e.target.value)
											}
											className="w-32"
										/>
										<span className="text-muted-foreground text-sm">to</span>
										<Input
											type="time"
											value={entry.endTime}
											onChange={(e) =>
												onUpdate(index, "endTime", e.target.value)
											}
											className="w-32"
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => onRemove(index)}
											aria-label="Remove time window"
										>
											<Trash2Icon className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						)}
						<Button variant="outline" size="sm" onClick={onAdd}>
							<Plus className="mr-1 h-3 w-3" /> Add Time Window
						</Button>
					</div>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}
