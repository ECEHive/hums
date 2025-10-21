import { db, periodExceptions } from "@ecehive/drizzle";
import { generatePeriodShiftOccurrences } from "@ecehive/features";
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
		// Get the exception to find its period
		const [existing] = await tx
			.select()
			.from(periodExceptions)
			.where(eq(periodExceptions.id, id))
			.limit(1);

		if (!existing) {
			return { success: false };
		}

		const periodId = existing.periodId;

		await tx.delete(periodExceptions).where(eq(periodExceptions.id, id));

		// Regenerate shift occurrences for the period since exception is removed
		await generatePeriodShiftOccurrences(tx, periodId);

		return { success: true };
	});
}
