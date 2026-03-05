import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const availabilityEntrySchema = z.object({
	dayOfWeek: z.number().min(0).max(6),
	startTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
	endTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
});

export const ZBulkSetSchema = z.object({
	userId: z.number().min(1),
	availabilities: z.array(availabilityEntrySchema).max(50),
});

export type TBulkSetSchema = z.infer<typeof ZBulkSetSchema>;

export type TBulkSetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TBulkSetSchema;
};

/**
 * Replace all availability windows for a user with the provided set.
 * This is an idempotent "set" operation — delete all, then insert.
 */
export async function bulkSetHandler(options: TBulkSetOptions) {
	const { userId, availabilities } = options.input;

	return await prisma.$transaction(async (tx) => {
		// Delete all existing availabilities for the user
		await tx.userAvailability.deleteMany({
			where: { userId },
		});

		// Insert the new set
		if (availabilities.length > 0) {
			await tx.userAvailability.createMany({
				data: availabilities.map((a) => ({
					userId,
					dayOfWeek: a.dayOfWeek,
					startTime: a.startTime,
					endTime: a.endTime,
				})),
			});
		}

		// Return the new state
		const result = await tx.userAvailability.findMany({
			where: { userId },
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return { availabilities: result };
	});
}
