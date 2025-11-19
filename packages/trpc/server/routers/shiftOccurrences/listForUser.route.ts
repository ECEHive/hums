import {
	assertCanAccessPeriod,
	computeOccurrenceEnd,
	getUserWithRoles,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForUserSchema = z.object({
	periodId: z.number().min(1),
	userId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListForUserSchema = z.infer<typeof ZListForUserSchema>;

export type TListForUserOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForUserSchema;
};

export async function listForUserHandler(options: TListForUserOptions) {
	const { periodId, userId, limit = 50, offset = 0 } = options.input;
	const now = new Date();

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: { select: { id: true } },
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	const targetUser = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			roles: { select: { id: true, name: true } },
		},
	});

	if (!targetUser) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Target user not found",
		});
	}

	const requiredRoleIds = period.roles.map((role) => role.id);

	if (
		requiredRoleIds.length > 0 &&
		!targetUser.roles.some((role) => requiredRoleIds.includes(role.id))
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "User is not eligible for this period",
		});
	}

	const occurrences = await prisma.shiftOccurrence.findMany({
		where: {
			users: {
				some: { id: userId },
			},
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
			timestamp: {
				gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: {
						include: {
							period: true,
						},
					},
				},
			},
			users: {
				select: {
					id: true,
					name: true,
				},
			},
			attendances: {
				where: { userId },
				select: {
					id: true,
					status: true,
					timeIn: true,
					timeOut: true,
					didArriveLate: true,
					didLeaveEarly: true,
					isMakeup: true,
					droppedNotes: true,
				},
			},
		},
		orderBy: { timestamp: "asc" },
	});

	const mapped = occurrences
		.map((occurrence) => {
			const occStart = new Date(occurrence.timestamp);
			const occEnd = computeOccurrenceEnd(
				occStart,
				occurrence.shiftSchedule.startTime,
				occurrence.shiftSchedule.endTime,
			);

			return {
				id: occurrence.id,
				timestamp: occurrence.timestamp,
				shiftScheduleId: occurrence.shiftScheduleId,
				shiftTypeId: occurrence.shiftSchedule.shiftType.id,
				shiftTypeName: occurrence.shiftSchedule.shiftType.name,
				shiftTypeLocation: occurrence.shiftSchedule.shiftType.location,
				shiftTypeColor: occurrence.shiftSchedule.shiftType.color,
				startTime: occurrence.shiftSchedule.startTime,
				endTime: occurrence.shiftSchedule.endTime,
				dayOfWeek: occurrence.shiftSchedule.dayOfWeek,
				users: occurrence.users,
				attendance: occurrence.attendances[0] ?? null,
				occEnd,
			};
		})
		.filter((occurrence) => occurrence.occEnd > now);

	const total = mapped.length;
	const paginated = mapped.slice(offset, offset + limit);

	return {
		occurrences: paginated,
		total,
	};
}
