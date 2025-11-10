import { type Prisma, prisma } from "@ecehive/prisma";
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
	const { search, limit = 100, offset = 0 } = options.input;

	const where: Prisma.KioskWhereInput = search
		? {
				OR: [
					{ name: { contains: search, mode: "insensitive" } },
					{ ipAddress: { contains: search, mode: "insensitive" } },
				],
			}
		: {};

	const [kiosks, count] = await Promise.all([
		prisma.kiosk.findMany({
			where,
			orderBy: { createdAt: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.kiosk.count({ where }),
	]);

	return {
		kiosks,
		count,
	};
}
