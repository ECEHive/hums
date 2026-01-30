import { type Prisma, prisma } from "@ecehive/prisma";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../trpc";
import { TicketStatusEnum } from "./schemas";

export const ZListMyTicketsSchema = z.object({
	// Filtering
	ticketTypeId: z.number().int().optional(),
	status: TicketStatusEnum.optional(),
	statuses: z.array(TicketStatusEnum).optional(),

	// Pagination
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),

	// Sorting
	sortBy: z.enum(["createdAt", "updatedAt", "status"]).default("createdAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function listMyTicketsHandler({
	ctx,
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZListMyTicketsSchema>;
}) {
	const where: Prisma.TicketWhereInput = {
		submitterId: ctx.user.id,
	};

	if (input.ticketTypeId) {
		where.ticketTypeId = input.ticketTypeId;
	}

	if (input.status) {
		where.status = input.status;
	} else if (input.statuses && input.statuses.length > 0) {
		where.status = { in: input.statuses };
	}

	const [tickets, total] = await Promise.all([
		prisma.ticket.findMany({
			where,
			include: {
				ticketType: {
					select: {
						id: true,
						name: true,
						icon: true,
						color: true,
					},
				},
				handler: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
			orderBy: { [input.sortBy]: input.sortOrder },
			take: input.limit,
			skip: input.offset,
		}),
		prisma.ticket.count({ where }),
	]);

	return {
		tickets,
		total,
		limit: input.limit,
		offset: input.offset,
	};
}
