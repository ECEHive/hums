import { db, shiftScheduleAssignments, shiftSchedules } from "@ecehive/drizzle";
import { assignUserToScheduleOccurrences } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	shiftScheduleId: z.number().min(1),
	userId: z.number().min(1),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { shiftScheduleId, userId } = options.input;

	return await db.transaction(async (tx) => {
		// Verify the shift schedule exists
		const [schedule] = await tx
			.select()
			.from(shiftSchedules)
			.where(eq(shiftSchedules.id, shiftScheduleId))
			.limit(1);

		if (!schedule) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift schedule not found",
			});
		}

		// Check if already assigned
		const [existing] = await tx
			.select()
			.from(shiftScheduleAssignments)
			.where(
				and(
					eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId),
					eq(shiftScheduleAssignments.userId, userId),
				),
			)
			.limit(1);

		if (existing) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "User already assigned to this shift schedule",
			});
		}

		// Create the assignment
		const [assignment] = await tx
			.insert(shiftScheduleAssignments)
			.values({
				shiftScheduleId,
				userId,
			})
			.returning();

		if (!assignment) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create assignment",
			});
		}

		// Assign user to all occurrences of this schedule
		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);

		return { assignment };
	});
}
