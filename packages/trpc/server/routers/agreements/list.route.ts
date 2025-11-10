import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
	isEnabled: z.boolean().optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, isEnabled, limit = 20, offset = 0 } = options.input;

	const where: Prisma.AgreementWhereInput = {
		...(search && { title: { contains: search, mode: "insensitive" } }),
		...(isEnabled !== undefined && { isEnabled }),
	};

	const [agreements, total] = await Promise.all([
		prisma.agreement.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			...(limit && { take: limit }),
		}),
		prisma.agreement.count({ where }),
	]);

	return { agreements, total };
}
