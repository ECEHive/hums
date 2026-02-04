/**
 * Control Logs Routes - List
 */

import { listControlLogs } from "@ecehive/features";
import { z } from "zod";

export const ZListLogsSchema = z.object({
	controlPointId: z.string().uuid().optional(),
	userId: z.number().int().optional(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK", "READ_STATE"]).optional(),
	success: z.boolean().optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function listLogsHandler({
	input,
}: {
	input: z.infer<typeof ZListLogsSchema>;
}) {
	return listControlLogs(input);
}
