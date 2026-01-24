import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	status: z
		.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED", "CANCELLED"])
		.optional(),
	requestedById: z.number().int().optional(),
	itemId: z.string().uuid().optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const {
		limit = 50,
		offset = 0,
		status,
		requestedById,
		itemId,
	} = options.input;

	const where: Prisma.ItemRequestWhereInput = {
		...(status && { status }),
		...(requestedById && { requestedById }),
		...(itemId && { itemId }),
	};

	const [requests, count] = await Promise.all([
		prisma.itemRequest.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
			include: {
				item: {
					select: {
						id: true,
						name: true,
						sku: true,
					},
				},
				requestedBy: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
				reviewedBy: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
			},
		}),
		prisma.itemRequest.count({ where }),
	]);

	return {
		requests,
		count,
	};
}
