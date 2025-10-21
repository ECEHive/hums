import {
	db,
	shiftOccurrenceAssignments,
	shiftOccurrences,
	users,
} from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({
	id: z.number().min(1),
});

export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const [shiftOccurrence] = await db
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.id, id));

	if (!shiftOccurrence) {
		return { shiftOccurrence: undefined, assignedUsers: [] };
	}

	// Get assigned users
	const assignments = await db
		.select({
			user: users,
			status: shiftOccurrenceAssignments.status,
		})
		.from(shiftOccurrenceAssignments)
		.innerJoin(users, eq(shiftOccurrenceAssignments.userId, users.id))
		.where(eq(shiftOccurrenceAssignments.shiftOccurrenceId, id));

	const assignedUsers = assignments.map((a) => ({
		...a.user,
		assignmentStatus: a.status,
	}));

	return { shiftOccurrence, assignedUsers };
}
