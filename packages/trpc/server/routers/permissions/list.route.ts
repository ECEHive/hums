import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	search: z.string().min(1).max(100).optional(),
});
export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search } = options.input;

	const where: Prisma.PermissionWhereInput = search
		? { name: { contains: search, mode: "insensitive" } }
		: {};

	const [permissions, total] = await Promise.all([
		prisma.permission.findMany({
			where,
			orderBy: { name: "asc" },
		}),
		prisma.permission.count({ where }),
	]);

	return { permissions, total };
}
