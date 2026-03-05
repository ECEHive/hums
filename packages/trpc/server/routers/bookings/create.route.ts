import { queueEmails } from "@ecehive/email";
import { env } from "@ecehive/env";
import { createInstantEventBooking } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	instantEventTypeId: z.number().min(1),
	startTime: z.date(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx: TProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { instantEventTypeId, startTime } = options.input;
	const requestorId = options.ctx.user.id;

	// Validate that startTime falls on an even 15-minute boundary
	const minutes = startTime.getMinutes();
	if (
		minutes % 15 !== 0 ||
		startTime.getSeconds() !== 0 ||
		startTime.getMilliseconds() !== 0
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Booking start time must be on an even 15-minute interval (e.g. :00, :15, :30, :45)",
		});
	}

	const result = await prisma.$transaction(
		async (tx) => {
			return createInstantEventBooking(tx, {
				instantEventTypeId,
				requestorId,
				startTime,
			});
		},
		{
			isolationLevel: "Serializable",
			timeout: 10000,
		},
	);

	if (!result.success) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: result.error ?? "Failed to create booking",
		});
	}

	// Re-fetch the booking with all relations
	const booking = await prisma.instantEventBooking.findUnique({
		where: { id: result.bookingId },
		include: {
			instantEventType: { select: { id: true, name: true } },
			requestor: {
				select: { id: true, name: true, username: true, email: true },
			},
			schedulers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});

	// Send confirmation emails to requestor and schedulers
	if (booking) {
		const baseUrl = env.CLIENT_BASE_URL;
		const schedulerNames = booking.schedulers.map((s) => s.name);
		const myBookingsUrl = `${baseUrl}/app/booking/my-bookings`;
		const bookingsUrl = `${baseUrl}/app/booking/bookings`;

		const emails = [
			{
				to: booking.requestor.email,
				template: "booking-confirmation" as const,
				data: {
					recipientName: booking.requestor.name,
					eventTypeName: booking.instantEventType.name,
					startTime: booking.startTime,
					endTime: booking.endTime,
					schedulerNames,
					isRequestor: true,
					cancelUrl: myBookingsUrl,
					rescheduleUrl: myBookingsUrl,
				},
			},
			...booking.schedulers.map((scheduler) => ({
				to: scheduler.email,
				template: "booking-confirmation" as const,
				data: {
					recipientName: scheduler.name,
					eventTypeName: booking.instantEventType.name,
					startTime: booking.startTime,
					endTime: booking.endTime,
					schedulerNames,
					isRequestor: false,
					cancelUrl: bookingsUrl,
					rescheduleUrl: null,
				},
			})),
		];
		queueEmails(emails);
	}

	return { booking };
}
