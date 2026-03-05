import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
	activeOnly: z.boolean().optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 10, offset = 0, search, activeOnly } = options.input;

	const where: Prisma.InstantEventTypeWhereInput = {};

	if (activeOnly) {
		where.isActive = true;
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ description: { contains: search, mode: "insensitive" } },
		];
	}

	const [eventTypes, total] = await Promise.all([
		prisma.instantEventType.findMany({
			where,
			include: {
				schedulerRoles: {
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				},
				participantRoles: {
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				},
				requiredRoles: {
					select: { id: true, name: true },
					orderBy: { name: "asc" },
				},
				_count: { select: { bookings: true } },
			},
			orderBy: { name: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.instantEventType.count({ where }),
	]);

	return { eventTypes, total };
}
