import {
	db,
	periods,
	shiftOccurrenceAssignments,
	shiftOccurrences,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDropSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
});

export type TDropSchema = z.infer<typeof ZDropSchema>;

export type TDropOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TDropSchema;
};

export async function dropHandler(options: TDropOptions) {
	const { shiftOccurrenceId } = options.input;
	const userId = options.ctx.user.id;

	return await db.transaction(async (tx) => {
		// Get the shift occurrence with period info
		const [occurrenceInfo] = await tx
			.select({
				occurrenceId: shiftOccurrences.id,
				timestamp: shiftOccurrences.timestamp,
				periodId: periods.id,
				scheduleModifyStart: periods.scheduleModifyStart,
				scheduleModifyEnd: periods.scheduleModifyEnd,
			})
			.from(shiftOccurrences)
			.innerJoin(
				shiftSchedules,
				eq(shiftOccurrences.shiftScheduleId, shiftSchedules.id),
			)
			.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
			.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
			.where(eq(shiftOccurrences.id, shiftOccurrenceId))
			.limit(1);

		if (!occurrenceInfo) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift occurrence not found",
			});
		}

		// Check if modifications are allowed for this period
		const now = new Date();
		const modifyStart = occurrenceInfo.scheduleModifyStart;
		const modifyEnd = occurrenceInfo.scheduleModifyEnd;

		if (modifyStart && modifyEnd) {
			if (now < modifyStart || now > modifyEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Shift modifications are not currently allowed for this period",
				});
			}
		}

		// Check if shift has already passed
		if (occurrenceInfo.timestamp < now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cannot drop a shift that has already occurred",
			});
		}

		// Get the user's assignment
		const [assignment] = await tx
			.select()
			.from(shiftOccurrenceAssignments)
			.where(
				and(
					eq(shiftOccurrenceAssignments.shiftOccurrenceId, shiftOccurrenceId),
					eq(shiftOccurrenceAssignments.userId, userId),
				),
			)
			.limit(1);

		if (!assignment) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are not assigned to this shift occurrence",
			});
		}

		if (assignment.status === "dropped") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "This shift has already been dropped",
			});
		}

		// Update the assignment status to dropped
		const [updated] = await tx
			.update(shiftOccurrenceAssignments)
			.set({
				status: "dropped",
				updatedAt: new Date(),
			})
			.where(eq(shiftOccurrenceAssignments.id, assignment.id))
			.returning();

		return { assignment: updated };
	});
}
