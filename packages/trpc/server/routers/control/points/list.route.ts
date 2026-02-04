import { listControlPoints } from "@ecehive/features";
import { z } from "zod";

export const ZListPointsSchema = z.object({
	search: z.string().optional(),
	providerId: z.number().int().optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]).optional(),
	isActive: z.boolean().optional(),
	canControlOnline: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortBy: z.enum(["name", "location", "createdAt"]).default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export async function listPointsHandler({
	input,
}: {
	input: z.infer<typeof ZListPointsSchema>;
}) {
	return listControlPoints(input);
}
