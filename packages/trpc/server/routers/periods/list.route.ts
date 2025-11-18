import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z
	.object({
		limit: z.number().min(1).max(100).optional(),
		offset: z.number().min(0).optional(),
		search: z.string().min(1).max(100).optional(),
		startsAfter: z.date().optional(),
		endsBefore: z.date().optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.startsAfter &&
			data.endsBefore &&
			data.startsAfter >= data.endsBefore
		) {
			ctx.addIssue({
				code: "custom",
				message: "startsAfter must be before endsBefore",
				path: ["startsAfter"],
			});
		}
	});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const {
		limit = 10,
		offset = 0,
		search,
		startsAfter,
		endsBefore,
	} = options.input;

	const where: Prisma.PeriodWhereInput = {};

	if (search) {
		where.name = { contains: search, mode: "insensitive" };
	}

	if (startsAfter) {
		where.end = { gte: startsAfter };
	}

	if (endsBefore) {
		where.start = { lte: endsBefore };
	}

	const [result, total] = await Promise.all([
		prisma.period.findMany({
			where,
			orderBy: { start: "asc" },
			skip: offset,
			take: limit,
			include: {
				roles: true,
			},
		}),
		prisma.period.count({ where }),
	]);

	return { periods: result, total };
}
