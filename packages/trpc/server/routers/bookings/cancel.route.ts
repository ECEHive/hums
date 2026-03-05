import { queueEmails } from "@ecehive/email";
import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCancelSchema = z.object({
	id: z.number().min(1),
	reason: z.string().optional(),
});

export type TCancelSchema = z.infer<typeof ZCancelSchema>;

export type TCancelOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCancelSchema;
};

export async function cancelHandler(options: TCancelOptions) {
	const { id, reason } = options.input;

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
