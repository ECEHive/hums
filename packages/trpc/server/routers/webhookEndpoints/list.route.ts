import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	search: z.string().min(1).max(100).optional(),
	isActive: z.boolean().optional(),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, isActive, limit, offset } = options.input;

	const webhookEndpoints = await prisma.webhookEndpoint.findMany({
		where: {
			name: {
				contains: search,
				mode: "insensitive",
			},
			isActive: isActive,
		},
		orderBy: { name: "asc" },
		skip: offset,
		take: limit,
	});

	if (!webhookEndpoints) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to list webhook endpoints",
		});
	}

	return { webhookEndpoints };
}
