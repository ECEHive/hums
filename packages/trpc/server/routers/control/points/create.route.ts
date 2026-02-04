/**
 * Control Points Routes - Create
 */

import { createControlPoint } from "@ecehive/features";
import { z } from "zod";

export const ZCreatePointSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	location: z.string().max(255).optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]),
	canControlOnline: z.boolean().optional(),
	canControlWithCode: z.boolean().optional(),
	providerId: z.number().int(),
	providerConfig: z.record(z.string(), z.unknown()),
	authorizedRoleIds: z.array(z.number().int()).optional(),
	authorizedUserIds: z.array(z.number().int()).optional(),
	isActive: z.boolean().optional(),
});

export async function createPointHandler({
	input,
}: {
	input: z.infer<typeof ZCreatePointSchema>;
}) {
	return createControlPoint(input);
}
