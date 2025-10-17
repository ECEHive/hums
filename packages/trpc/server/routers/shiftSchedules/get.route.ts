import { db, shiftOccurrences, shiftSchedules } from "@ecehive/drizzle";
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
		return { shiftSchedule: undefined, occurrences: [] };
	}

	const occurrences = await db
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, id))
		.orderBy(shiftOccurrences.timestamp);

	return { shiftSchedule, occurrences };
}
