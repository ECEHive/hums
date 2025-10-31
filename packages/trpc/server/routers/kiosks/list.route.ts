import { db, kiosks } from "@ecehive/drizzle";
import { countDistinct, ilike, or, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, limit, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		const escapeLike = (s: string) =>
			s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
		const pattern = `%${escapeLike(search)}%`;
		filters.push(
			or(ilike(kiosks.name, pattern), ilike(kiosks.ipAddress, pattern)),
		);
	}

	const [{ count }] = await db
		.select({ count: countDistinct(kiosks.id) })
		.from(kiosks)
		.where(filters.length > 0 ? or(...filters) : undefined);

	const kiosksList = await db
		.select()
		.from(kiosks)
		.where(filters.length > 0 ? or(...filters) : undefined)
		.limit(limit ?? 100)
		.offset(offset)
		.orderBy(kiosks.createdAt);

	return {
		kiosks: kiosksList,
		count,
	};
}
