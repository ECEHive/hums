import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCloneSchema = z.object({
	clonePeriodId: z.number().int().min(1),
	name: z.string().min(1).max(100),
});

export type TCloneSchema = z.infer<typeof ZCloneSchema>;

export type TCloneOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCloneSchema;
};

export async function cloneHandler(options: TCloneOptions) {
	const { clonePeriodId, name } = options.input;

	const sourcePeriod = await prisma.period.findUnique({
		where: { id: clonePeriodId },
		include: {
			roles: {
				select: { id: true },
			},
			periodExceptions: true,
			shiftTypes: {
				include: {
					roles: {
						select: { id: true },
					},
					shiftSchedules: true,
				},
			},
		},
	});

	if (!sourcePeriod) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Source period not found",
		});
	}

	return await prisma.$transaction(async (tx) => {
		const clonedPeriod = await tx.period.create({
			data: {
				name,
				start: sourcePeriod.start,
				end: sourcePeriod.end,
				visibleStart: sourcePeriod.visibleStart,
				visibleEnd: sourcePeriod.visibleEnd,
				scheduleSignupStart: sourcePeriod.scheduleSignupStart,
				scheduleSignupEnd: sourcePeriod.scheduleSignupEnd,
				scheduleModifyStart: sourcePeriod.scheduleModifyStart,
				scheduleModifyEnd: sourcePeriod.scheduleModifyEnd,
				min: sourcePeriod.min,
				max: sourcePeriod.max,
				minMaxUnit: sourcePeriod.minMaxUnit,
				roles: sourcePeriod.roles.length
					? {
							connect: sourcePeriod.roles.map((role) => ({ id: role.id })),
						}
					: undefined,
			},
		});

		if (sourcePeriod.periodExceptions.length > 0) {
			await tx.periodException.createMany({
				data: sourcePeriod.periodExceptions.map((exception) => ({
					periodId: clonedPeriod.id,
					name: exception.name,
					start: exception.start,
					end: exception.end,
				})),
			});
		}

		for (const sourceShiftType of sourcePeriod.shiftTypes) {
			const clonedShiftType = await tx.shiftType.create({
				data: {
					periodId: clonedPeriod.id,
					name: sourceShiftType.name,
					location: sourceShiftType.location,
					description: sourceShiftType.description,
					color: sourceShiftType.color,
					icon: sourceShiftType.icon,
					isBalancedAcrossOverlap: sourceShiftType.isBalancedAcrossOverlap,
					isBalancedAcrossDay: sourceShiftType.isBalancedAcrossDay,
					isBalancedAcrossPeriod: sourceShiftType.isBalancedAcrossPeriod,
					canSelfAssign: sourceShiftType.canSelfAssign,
					doRequireRoles: sourceShiftType.doRequireRoles,
					roles: sourceShiftType.roles.length
						? {
								connect: sourceShiftType.roles.map((role) => ({ id: role.id })),
							}
						: undefined,
				},
			});

			if (sourceShiftType.shiftSchedules.length > 0) {
				await tx.shiftSchedule.createMany({
					data: sourceShiftType.shiftSchedules.map((schedule) => ({
						shiftTypeId: clonedShiftType.id,
						slots: schedule.slots,
						dayOfWeek: schedule.dayOfWeek,
						startTime: schedule.startTime,
						endTime: schedule.endTime,
					})),
				});
			}
		}

		await generatePeriodShiftOccurrences(tx, clonedPeriod.id);

		const periodWithRoles = await tx.period.findUnique({
			where: { id: clonedPeriod.id },
			include: {
				roles: true,
			},
		});

		if (!periodWithRoles) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to clone period",
			});
		}

		return { period: periodWithRoles };
	});
}
