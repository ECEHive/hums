import {
	type ListControlPointsOptions,
	listControlPoints,
} from "@ecehive/features";
import { z } from "zod";

export const ZEquipmentStatusSchema = z.object({
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortBy: z.enum(["name", "location", "createdAt"]).default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

type EquipmentStatus = {
	[location: string]: {
		controlPointName: string;
		isActive: boolean;
		status: boolean;
	}[];
};

export async function equipmentStatusHandler({
	input,
}: {
	input: z.infer<typeof ZEquipmentStatusSchema>;
}) {
	// Fetch control points (equipment) with the provided options
	const options = input as ListControlPointsOptions;
	options.controlClass = "SWITCH"; // No doors
	const points = await listControlPoints(options);

	// Group the control points by their location for the overview display
	const groupedByLocation: Record<
		string,
		{ controlPointName: string; isActive: boolean; status: boolean }[]
	> = {};
	for (const point of points.points) {
		const location = point.location || "Unknown Location";
		if (!groupedByLocation[location]) {
			groupedByLocation[location] = [];
		}
		groupedByLocation[location].push({
			controlPointName: point.name,
			isActive: point.isActive,
			status: point.currentState,
		});
	}
	const sortedGroupedByLocation: EquipmentStatus = {};
	for (const location of Object.keys(groupedByLocation).sort()) {
		sortedGroupedByLocation[location] = groupedByLocation[location];
	}
	return sortedGroupedByLocation as EquipmentStatus;
}
