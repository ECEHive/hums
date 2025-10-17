import {
	db,
	periods,
	shiftOccurrences,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import { generateOccurrenceTimestamps } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	periodId: z.number().min(1).optional(),
	name: z.string().min(1).max(200).optional(),
	location: z.string().min(1).max(200).optional(),
	description: z.string().min(1).max(2000).optional().nullable(),
	color: z.string().min(1).max(50).optional().nullable(),
	icon: z.string().min(1).max(100).optional().nullable(),
	isBalancedAcrossOverlap: z.boolean().optional(),
	isBalancedAcrossDay: z.boolean().optional(),
	isBalancedAcrossPeriod: z.boolean().optional(),
	canSelfAssign: z.boolean().optional(),
	doRequireRoles: z.boolean().optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function updateHandler(options: TUpdateOptions) {
	const {
		id,
		periodId,
		name,
		location,
		description,
		color,
		icon,
		isBalancedAcrossOverlap,
		isBalancedAcrossDay,
		isBalancedAcrossPeriod,
		canSelfAssign,
		doRequireRoles,
	} = options.input;

	const [existing] = await db
		.select()
		.from(shiftTypes)
		.where(eq(shiftTypes.id, id))
		.limit(1);

	if (!existing) {
		return { shiftType: undefined };
	}

	let targetPeriod: typeof periods.$inferSelect | undefined;

	if (periodId !== undefined && periodId !== existing.periodId) {
		const [period] = await db
			.select()
			.from(periods)
			.where(eq(periods.id, periodId))
			.limit(1);

		if (!period) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Period not found",
			});
		}

		targetPeriod = period;
	}

	return await db.transaction(async (tx) => {
		const updates: Partial<typeof shiftTypes.$inferInsert> = {};

		if (periodId !== undefined) {
			updates.periodId = periodId;
		}

		if (name !== undefined) {
			updates.name = name;
		}

		if (location !== undefined) {
			updates.location = location;
		}

		if (description !== undefined) {
			updates.description = description;
		}

		if (color !== undefined) {
			updates.color = color;
		}

		if (icon !== undefined) {
			updates.icon = icon;
		}

		if (isBalancedAcrossOverlap !== undefined) {
			updates.isBalancedAcrossOverlap = isBalancedAcrossOverlap;
		}

		if (isBalancedAcrossDay !== undefined) {
			updates.isBalancedAcrossDay = isBalancedAcrossDay;
		}

		if (isBalancedAcrossPeriod !== undefined) {
			updates.isBalancedAcrossPeriod = isBalancedAcrossPeriod;
		}

		if (canSelfAssign !== undefined) {
			updates.canSelfAssign = canSelfAssign;
		}

		if (doRequireRoles !== undefined) {
			updates.doRequireRoles = doRequireRoles;
		}

		updates.updatedAt = new Date();

		const updatedRows = await tx
			.update(shiftTypes)
			.set(updates)
			.where(eq(shiftTypes.id, id))
			.returning();

		const updated = updatedRows[0];

		if (!updated) {
			return { shiftType: undefined };
		}

		if (periodId !== undefined && periodId !== existing.periodId) {
			const period = targetPeriod ?? (await getPeriod(tx, updated.periodId));

			if (!period) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Updated period not found",
				});
			}

			await syncShiftTypeSchedules(tx, updated.id, period);
		}

		return { shiftType: updated };
	});
}

async function getPeriod(
	tx: TransactionClient,
	periodId: number,
): Promise<typeof periods.$inferSelect | undefined> {
	const [period] = await tx
		.select()
		.from(periods)
		.where(eq(periods.id, periodId))
		.limit(1);

	return period;
}

async function syncShiftTypeSchedules(
	tx: TransactionClient,
	shiftTypeId: number,
	period: typeof periods.$inferSelect,
) {
	const schedules = await tx
		.select({
			id: shiftSchedules.id,
			dayOfWeek: shiftSchedules.dayOfWeek,
			startTime: shiftSchedules.startTime,
		})
		.from(shiftSchedules)
		.where(eq(shiftSchedules.shiftTypeId, shiftTypeId));

	for (const schedule of schedules) {
		await tx
			.delete(shiftOccurrences)
			.where(eq(shiftOccurrences.shiftScheduleId, schedule.id));

		const occurrences = generateOccurrenceTimestamps({
			period: { id: period.id, start: period.start, end: period.end },
			schedule,
		});

		if (occurrences.length === 0) {
			await tx.delete(shiftSchedules).where(eq(shiftSchedules.id, schedule.id));
			continue;
		}

		const values = occurrences.map((timestamp) => ({
			shiftScheduleId: schedule.id,
			timestamp,
		}));

		await tx.insert(shiftOccurrences).values(values);
	}
}
