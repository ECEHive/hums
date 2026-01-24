import {
	generateShiftScheduleShiftOccurrences,
	type Transaction,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
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
	doRequireRoles: z.enum(["disabled", "all", "any"]).optional(),
	roleIds: z.array(z.number().min(1)).optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

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
		roleIds,
	} = options.input;

	const existing = await prisma.shiftType.findUnique({
		where: { id },
	});

	if (!existing) {
		return { shiftType: undefined };
	}

	// Verify the new period exists if changing periods
	if (periodId !== undefined && periodId !== existing.periodId) {
		const period = await prisma.period.findUnique({
			where: { id: periodId },
		});

		if (!period) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Period not found",
			});
		}
	}

	return await prisma.$transaction(async (tx) => {
		const updated = await tx.shiftType.update({
			where: { id },
			data: {
				...(periodId !== undefined && { periodId }),
				...(name !== undefined && { name }),
				...(location !== undefined && { location }),
				...(description !== undefined && { description }),
				...(color !== undefined && { color }),
				...(icon !== undefined && { icon }),
				...(isBalancedAcrossOverlap !== undefined && {
					isBalancedAcrossOverlap,
				}),
				...(isBalancedAcrossDay !== undefined && { isBalancedAcrossDay }),
				...(isBalancedAcrossPeriod !== undefined && { isBalancedAcrossPeriod }),
				...(canSelfAssign !== undefined && { canSelfAssign }),
				...(doRequireRoles !== undefined && { doRequireRoles }),
				...(roleIds !== undefined
					? {
							roles: {
								set: roleIds.map((roleId) => ({ id: roleId })),
							},
						}
					: {}),
			},
			include: {
				roles: {
					orderBy: { name: "asc" },
				},
			},
		});

		if (!updated) {
			return { shiftType: undefined };
		}

		if (periodId !== undefined && periodId !== existing.periodId) {
			// ShiftType moved to a different period, regenerate all occurrences
			// Use skipPastOccurrences to only create future occurrences in the new period
			await syncShiftTypeSchedules(tx, updated.id);
		}

		return { shiftType: updated };
	});
}

/**
 * Regenerate shift occurrences for all schedules of a shift type.
 * This is used when a shift type is moved to a different period.
 * The function uses generateShiftScheduleShiftOccurrences which respects
 * period exceptions and properly handles slot counts.
 */
async function syncShiftTypeSchedules(tx: Transaction, shiftTypeId: number) {
	const schedules = await tx.shiftSchedule.findMany({
		where: { shiftTypeId },
		select: {
			id: true,
		},
	});

	for (const schedule of schedules) {
		// Use the proper generation function that respects period exceptions
		// and handles slot counts correctly. Use skipPastOccurrences since
		// we're moving to a new period and shouldn't create past occurrences.
		await generateShiftScheduleShiftOccurrences(tx, schedule.id, {
			skipPastOccurrences: true,
		});
	}
}
