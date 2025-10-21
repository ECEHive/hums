import { db, periods } from "@ecehive/drizzle";
import { and, count, gte, ilike, lte, type SQL } from "drizzle-orm";
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

	const filters = [] as (SQL | undefined)[];

	if (search) {
		const escapeLike = (s: string) =>
			s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
		const pattern = `%${escapeLike(search)}%`;
		filters.push(ilike(periods.name, pattern));
	}

	if (startsAfter) {
		filters.push(gte(periods.end, startsAfter));
	}

	if (endsBefore) {
		filters.push(lte(periods.start, endsBefore));
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(periods)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(periods.start);

	const [total] = await db
		.select({ count: count(periods.id) })
		.from(periods)
		.where(whereClause);

	return { periods: result, total: total?.count ?? 0 };
}
