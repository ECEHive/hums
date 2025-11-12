import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZBulkDeleteSchema = z.object({
	shiftTypeIds: z.array(z.number().min(1)).min(1),
	daysOfWeek: z.array(z.number().min(0).max(6)).min(1),
});

export type TBulkDeleteSchema = z.infer<typeof ZBulkDeleteSchema>;

export type TBulkDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TBulkDeleteSchema;
};

export async function bulkDeleteHandler(options: TBulkDeleteOptions) {
	const { shiftTypeIds, daysOfWeek } = options.input;

	// Delete all shift schedules matching the criteria
	const result = await prisma.shiftSchedule.deleteMany({
		where: {
			shiftTypeId: { in: shiftTypeIds },
			dayOfWeek: { in: daysOfWeek },
		},
	});

	return { deletedCount: result.count };
}
