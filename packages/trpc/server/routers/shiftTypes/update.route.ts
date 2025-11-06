import { generateOccurrenceTimestamps } from "@ecehive/features";
import { type Prisma, prisma } from "@ecehive/prisma";
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

type TransactionClient = Omit<
	typeof prisma,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

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

	let targetPeriod: Prisma.PeriodGetPayload<object> | undefined;

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

		targetPeriod = period;
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
): Promise<Prisma.PeriodGetPayload<object> | null> {
	return await tx.period.findUnique({
		where: { id: periodId },
	});
}

async function syncShiftTypeSchedules(
	tx: TransactionClient,
	shiftTypeId: number,
	period: Prisma.PeriodGetPayload<object>,
) {
	const schedules = await tx.shiftSchedule.findMany({
		where: { shiftTypeId },
		select: {
			id: true,
			dayOfWeek: true,
			startTime: true,
		},
	});

	for (const schedule of schedules) {
		await tx.shiftOccurrence.deleteMany({
			where: { shiftScheduleId: schedule.id },
		});

		const occurrences = generateOccurrenceTimestamps(
			period.start,
			period.end,
			schedule.dayOfWeek,
			schedule.startTime,
		);

		if (occurrences.length === 0) {
			await tx.shiftSchedule.delete({
				where: { id: schedule.id },
			});
			continue;
		}

		await tx.shiftOccurrence.createMany({
			data: occurrences.map((timestamp) => ({
				shiftScheduleId: schedule.id,
				timestamp,
			})),
		});
	}
}
