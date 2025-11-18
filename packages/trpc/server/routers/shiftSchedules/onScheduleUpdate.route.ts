import type { ShiftScheduleUpdateEvent } from "@ecehive/features";
import {
	assertCanAccessPeriod,
	getPeriodById,
	getUserWithRoles,
	shiftScheduleEvents,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError, tracked } from "@trpc/server";
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

	// Create an async iterable from the event emitter
	// This properly handles the EventEmitter and AbortSignal
	const iterable = shiftScheduleEvents.toIterable("update", {
		signal: opts.signal,
	});

	// Listen for new events and yield them with tracking
	for await (const [data] of iterable) {
		const event = data as ShiftScheduleUpdateEvent;

		// Only send events for the requested period
		if (event.periodId === periodId) {
			// Use the timestamp as the event ID for tracking
			const eventId = event.timestamp.getTime().toString();
			yield tracked(eventId, event);
		}
	}
}
