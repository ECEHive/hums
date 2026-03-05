import { queueEmails } from "@ecehive/email";
import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZCancelMyBookingSchema = z.object({
	id: z.number().min(1),
	reason: z.string().optional(),
});

export type TCancelMyBookingSchema = z.infer<typeof ZCancelMyBookingSchema>;

export type TCancelMyBookingOptions = {
	ctx: TProtectedProcedureContext;
	input: TCancelMyBookingSchema;
};

export async function cancelMyBookingHandler(options: TCancelMyBookingOptions) {
	const { id, reason } = options.input;
	const userId = options.ctx.user.id;

	const booking = await prisma.instantEventBooking.findUnique({
		where: { id },
		include: {
			instantEventType: { select: { id: true, name: true } },
			requestor: { select: { id: true, name: true, email: true } },
			schedulers: { select: { id: true, name: true, email: true } },
		},
	});

	if (!booking) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Booking not found",
		});
	}

	// Only the requestor can cancel their own booking
	if (booking.requestorId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only cancel your own bookings",
		});
	}

	// Only allow canceling upcoming bookings
	if (booking.startTime <= new Date()) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot cancel a booking that has already started or passed",
		});
	}

	const deleted = await prisma.instantEventBooking.delete({
		where: { id },
	});

	// Send cancellation emails to requestor and schedulers
	const baseUrl = env.CLIENT_BASE_URL;
	const emails = [
		{
			to: booking.requestor.email,
			template: "booking-cancellation" as const,
			data: {
				recipientName: booking.requestor.name,
				eventTypeName: booking.instantEventType.name,
				startTime: booking.startTime,
				endTime: booking.endTime,
				reason: reason ?? null,
				showBookAgain: true,
				bookAgainUrl: `${baseUrl}/app/booking/book/${booking.instantEventType.id}`,
			},
		},
		...booking.schedulers.map((scheduler) => ({
			to: scheduler.email,
			template: "booking-cancellation" as const,
			data: {
				recipientName: scheduler.name,
				eventTypeName: booking.instantEventType.name,
				startTime: booking.startTime,
				endTime: booking.endTime,
				reason: reason ?? null,
				showBookAgain: false,
				bookAgainUrl: null,
			},
		})),
	];
	queueEmails(emails);

	return { booking: deleted };
}
