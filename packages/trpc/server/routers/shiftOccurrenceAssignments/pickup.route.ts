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

export const ZPickupSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
});

export type TPickupSchema = z.infer<typeof ZPickupSchema>;

export type TPickupOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TPickupSchema;
};

export async function pickupHandler(options: TPickupOptions) {
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
				message: "Cannot pick up a shift that has already occurred",
			});
		}

		// Check if user is already assigned to this occurrence
		const [existingAssignment] = await tx
			.select()
			.from(shiftOccurrenceAssignments)
			.where(
				and(
					eq(shiftOccurrenceAssignments.shiftOccurrenceId, shiftOccurrenceId),
					eq(shiftOccurrenceAssignments.userId, userId),
				),
			)
			.limit(1);

		if (existingAssignment) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are already assigned to this shift occurrence",
			});
		}

		// Check if there's a dropped assignment available
		const [droppedAssignment] = await tx
			.select()
			.from(shiftOccurrenceAssignments)
			.where(
				and(
					eq(shiftOccurrenceAssignments.shiftOccurrenceId, shiftOccurrenceId),
					eq(shiftOccurrenceAssignments.status, "dropped"),
				),
			)
			.limit(1);

		if (!droppedAssignment) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "No dropped shifts available for this occurrence",
			});
		}

		// Create a new assignment with picked_up status
		const [newAssignment] = await tx
			.insert(shiftOccurrenceAssignments)
			.values({
				shiftOccurrenceId,
				userId,
				status: "picked_up",
			})
			.returning();

		return { assignment: newAssignment };
	});
}
