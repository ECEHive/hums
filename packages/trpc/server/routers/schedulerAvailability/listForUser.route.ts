import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListForUserSchema = z.object({
	userId: z.number().min(1).optional(),
});

export type TListForUserSchema = z.infer<typeof ZListForUserSchema>;

export type TListForUserOptions = {
	ctx: TProtectedProcedureContext;
	input: TListForUserSchema;
};

export async function listForUserHandler(options: TListForUserOptions) {
	const userId = options.input.userId ?? options.ctx.user.id;

	const availabilities = await prisma.userAvailability.findMany({
		where: { userId },
		orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
	});

	return { availabilities };
}
