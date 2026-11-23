import type { ShiftScheduleUpdateEvent } from "@ecehive/features";
import {
	assertCanAccessPeriod,
	getPeriodById,
	getUserWithRoles,
	shiftScheduleEvents,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZOnScheduleUpdateSchema = z.object({
	periodId: z.number().min(1),
	lastEventId: z.string().nullish(),
});

export type TOnScheduleUpdateSchema = z.infer<typeof ZOnScheduleUpdateSchema>;

/**
 * Subscription that streams real-time shift schedule registration updates.
 * Clients receive events when users register or unregister for shifts.
 */
export async function* onScheduleUpdateHandler(opts: {
	ctx: TProtectedProcedureContext;
	input: TOnScheduleUpdateSchema;
	signal?: AbortSignal;
}) {
	const { periodId } = opts.input;
	const { ctx } = opts;

	const [user, period] = await Promise.all([
		getUserWithRoles(prisma, ctx.user.id),
		getPeriodById(prisma, periodId),
	]);

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((role) => role.id));
	assertCanAccessPeriod(period, userRoleIds, {
		isSystemUser: ctx.user.isSystemUser,
	});

	for await (const [batch] of shiftScheduleEvents.batches(opts.signal)) {
		const events = batch.filter((event) => event.periodId === periodId);
		if (events.length > 0) {
			const result: { events: ShiftScheduleUpdateEvent[] } = { events };
			yield result;
		}
	}
}
