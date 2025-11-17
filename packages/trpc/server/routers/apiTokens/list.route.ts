import { toApiTokenDTO } from "@ecehive/features";
import { Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	offset: z.number().int().min(0).optional(),
	search: z.string().trim().min(1).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 20, offset = 0, search } = options.input;

	let where: Prisma.ApiTokenWhereInput | undefined;
	if (search) {
		const insensitive = Prisma.QueryMode.insensitive;
		where = {
			OR: [
				{ name: { contains: search, mode: insensitive } },
				{ description: { contains: search, mode: insensitive } },
				{ prefix: { contains: search, mode: insensitive } },
			],
		};
	}

	const [records, total] = await Promise.all([
		prisma.apiToken.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
		}),
		prisma.apiToken.count({ where }),
	]);

	return {
		tokens: records.map(toApiTokenDTO),
		total,
	};
}
