/**
 * Control Points Routes - Update
 */

import { updateControlPoint } from "@ecehive/features";
import { z } from "zod";

export const ZUpdatePointSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).optional().nullable(),
	location: z.string().max(255).optional().nullable(),
	controlClass: z.enum(["SWITCH", "DOOR"]).optional(),
	canControlOnline: z.boolean().optional(),
	canControlWithCode: z.boolean().optional(),
	providerId: z.number().int().optional(),
	providerConfig: z.record(z.string(), z.unknown()).optional(),
	authorizedRoleIds: z.array(z.number().int()).optional(),
	authorizedUserIds: z.array(z.number().int()).optional(),
	autoTurnOffEnabled: z.boolean().optional(),
	autoTurnOffMinutes: z.number().int().min(1).optional().nullable(),
	isActive: z.boolean().optional(),
});

export async function updatePointHandler({
	input,
}: {
	input: z.infer<typeof ZUpdatePointSchema>;
}) {
	return updateControlPoint(input);
}
