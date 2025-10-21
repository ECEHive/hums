import {
	db,
	shiftOccurrences,
	shiftScheduleAssignments,
	shiftSchedules,
	users,
} from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({ id: z.number().min(1) });
export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const [shiftSchedule] = await db
		.select()
		.from(shiftSchedules)
		.where(eq(shiftSchedules.id, id));

	if (!shiftSchedule) {
		return { shiftSchedule: undefined, occurrences: [], assignedUsers: [] };
	}

	const occurrences = await db
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, id))
		.orderBy(shiftOccurrences.timestamp);

	// Get assigned users
	const assignments = await db
		.select({
			user: users,
		})
		.from(shiftScheduleAssignments)
		.innerJoin(users, eq(shiftScheduleAssignments.userId, users.id))
		.where(eq(shiftScheduleAssignments.shiftScheduleId, id));

	const assignedUsers = assignments.map((a) => a.user);

	return { shiftSchedule, occurrences, assignedUsers };
}
