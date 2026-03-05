import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvailabilityDayEditor } from "./availability";

export const Route = createFileRoute("/app/booking/my-availability")({
	component: MyAvailabilityPage,
});

type AvailabilityEntry = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

function MyAvailabilityPage() {
	const queryClient = useQueryClient();

	// Check if the user is eligible (has a scheduler role for an active event)
	const { data: eligibility, isLoading: loadingEligibility } = useQuery({
		queryKey: ["scheduling", "canSetAvailability"],
		queryFn: () => trpc.schedulerAvailability.canSetAvailability.query(),
	});

	// Fetch user's current availability
	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["scheduling", "myAvailability"],
		queryFn: () => trpc.schedulerAvailability.listForUser.query({}),
		enabled: eligibility?.canSetAvailability === true,
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
		mutationFn: (availabilities: AvailabilityEntry[]) =>
			trpc.schedulerAvailability.setMyAvailability.mutate({ availabilities }),
		onSuccess: () => {
			toast.success("Availability saved");
			setIsDirty(false);
			queryClient.invalidateQueries({
				queryKey: ["scheduling", "myAvailability"],
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
		saveMutation.mutate(entries);
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

	if (loadingEligibility || isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (!eligibility?.canSetAvailability) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>My Availability</PageTitle>
				</PageHeader>
				<PageContent>
					<div className="flex flex-col items-center justify-center py-16">
						<h3 className="font-medium text-lg">Not Eligible</h3>
						<p className="text-muted-foreground text-sm">
							You are not currently assigned as a scheduler for any active
							event. Contact an administrator if you believe this is an error.
						</p>
					</div>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Availability</PageTitle>
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
				<p className="text-muted-foreground mb-6 text-sm">
					Set the times you are available to be assigned as a scheduler. Your
					availability is used when participants book events.
				</p>

				<div className="space-y-6">
					<AvailabilityDayEditor
						entriesByDay={entriesByDay}
						onAdd={addEntry}
						onRemove={removeEntry}
						onUpdate={updateEntry}
					/>

					{isDirty && (
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
