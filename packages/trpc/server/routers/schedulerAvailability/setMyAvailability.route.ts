import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const availabilityEntrySchema = z.object({
	dayOfWeek: z.number().min(0).max(6),
	startTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
	endTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
});

export const ZSetMyAvailabilitySchema = z.object({
	availabilities: z.array(availabilityEntrySchema).max(50),
});

export type TSetMyAvailabilitySchema = z.infer<typeof ZSetMyAvailabilitySchema>;

export type TSetMyAvailabilityOptions = {
	ctx: TProtectedProcedureContext;
	input: TSetMyAvailabilitySchema;
};

/**
 * Self-service endpoint: allows a user to set their own availability,
 * but only if they have a scheduler role for at least one active instant event type.
 */
export async function setMyAvailabilityHandler(
	options: TSetMyAvailabilityOptions,
) {
	const userId = options.ctx.user.id;
	const { availabilities } = options.input;

	// Verify user has a scheduler role for at least one active event type
	const eventWithUser = await prisma.instantEventType.findFirst({
		where: {
			isActive: true,
			schedulerRoles: {
				some: {
					users: {
						some: { id: userId },
					},
				},
			},
		},
		select: { id: true },
	});

	if (!eventWithUser) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"You must be assigned a scheduler role for an active event type to set availability",
		});
	}

	return await prisma.$transaction(async (tx) => {
		await tx.userAvailability.deleteMany({ where: { userId } });

		if (availabilities.length > 0) {
			await tx.userAvailability.createMany({
				data: availabilities.map((a) => ({
					userId,
					dayOfWeek: a.dayOfWeek,
					startTime: a.startTime,
					endTime: a.endTime,
				})),
			});
		}

		const result = await tx.userAvailability.findMany({
			where: { userId },
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return { availabilities: result };
	});
}
