import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	userId: z.number().min(1).optional(),
	limit: z.number().min(1).max(500).optional(),
	offset: z.number().min(0).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { userId, limit = 100, offset = 0 } = options.input;

	const where = userId ? { userId } : {};

	const [availabilities, total] = await Promise.all([
		prisma.userAvailability.findMany({
			where,
			include: {
				user: { select: { id: true, name: true, username: true } },
			},
			orderBy: [{ userId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
			skip: offset,
			take: limit,
		}),
		prisma.userAvailability.count({ where }),
	]);

	return { availabilities, total };
}
