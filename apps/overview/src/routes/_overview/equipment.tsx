import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_overview/equipment")({
	component: EquipmentPage,
});

function EquipmentList({
	data,
}: {
	data: Record<
		string,
		{ controlPointName: string; isActive: boolean; status: boolean }[]
	>;
}) {
	return (
		<div className="space-y-4 md:space-y-6 flex flex-wrap gap-x-20 gap-y-4">
			{Object.entries(data).map(([location, equipmentAtLocation]) => (
				<div key={location} className="space-y-2">
					<h2 className="text-base md:text-lg font-semibold">{location}</h2>
					<div className="flex flex-wrap gap-4">
						{equipmentAtLocation.map((equipment) => (
							<Card
								key={equipment.controlPointName}
								className={`w-25 min-h-25 flex flex-col justify-between border-2 p-3 text-center ${
									equipment.isActive
										? !equipment.status
											? "border-green-500 bg-green-500/10 text-green-950 dark:text-green-50"
											: "border-yellow-500 bg-yellow-500/10 text-yellow-950 dark:text-yellow-50"
										: "border-gray-5000 bg-gray-500/10 text-gray-950 dark:text-gray-50"
								}`}
							>
								<div className="flex-1 flex items-center justify-center my-auto">
									<span className="text-xs font-medium leading-snug break-words">
										{equipment.controlPointName}
									</span>
								</div>
								<span
									className={`mt-auto text-[10px] font-semibold ${
										equipment.isActive
											? !equipment.status
												? "text-green-600 dark:text-green-400"
												: "text-yellow-600 dark:text-yellow-400"
											: "text-gray-500 dark:text-gray-400"
									}`}
								>
									{equipment.isActive
										? !equipment.status
											? "Available"
											: "In Use"
										: "Down"}
								</span>
							</Card>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function EquipmentPage() {
	const { data: equipmentStatus, isLoading: equipmentStatusLoading } = useQuery(
		{
			queryKey: ["overview", "equipmentStatus"],
			queryFn: () => trpc.overview.equipmentStatus.query({}),
			refetchInterval: 10 * 1000, // Refresh every 10 seconds for more live feel
		},
	);

	return (
		<div className="space-y-4 md:space-y-6">
			{/* Page Header */}
			<div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">
					Equipment
				</h1>
				<p className="text-sm md:text-base text-muted-foreground">
					Real-time equipment status
				</p>
			</div>

			{/* Equipment Status */}
			<Card>
				<CardHeader className="pb-2 md:pb-4">
					<div className="flex items-center gap-2">
						<CardTitle className="text-base md:text-lg">
							Equipment Status
						</CardTitle>
					</div>
					<CardDescription className="text-xs md:text-sm">
						All equipment is available on a first come, first served basis
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-0">
					{equipmentStatusLoading ? (
						<div className="flex items-center justify-between py-2">
							<span className="text-sm md:text-base">Loading...</span>
						</div>
					) : (
						<EquipmentList data={equipmentStatus ?? {}} />
					)}
				</CardContent>
			</Card>
		</div>
	);
}
