import { db, shiftScheduleAssignments } from "@ecehive/drizzle";
import { unassignUserFromScheduleOccurrences } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.object({
	id: z.number().min(1),
});

export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	return await db.transaction(async (tx) => {
		// Get the assignment
		const [assignment] = await tx
			.select()
			.from(shiftScheduleAssignments)
			.where(eq(shiftScheduleAssignments.id, id))
			.limit(1);

		if (!assignment) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Assignment not found",
			});
		}

		// Remove the assignment
		await tx
			.delete(shiftScheduleAssignments)
			.where(eq(shiftScheduleAssignments.id, id));

		// Remove user from all occurrences of this schedule
		await unassignUserFromScheduleOccurrences(
			tx,
			assignment.shiftScheduleId,
			assignment.userId,
		);

		return { success: true };
	});
}
