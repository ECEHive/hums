import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZUpdateSchema = z.object({
	id: z.string().uuid(),
	status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED", "CANCELLED"]),
	reviewNotes: z.string().max(1000).optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, status, reviewNotes } = options.input;
	const userId = options.ctx.user.id;

	const request = await prisma.itemRequest.update({
		where: { id },
		data: {
			status,
			reviewNotes,
			reviewedById: userId,
			reviewedAt: new Date(),
		},
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
	});

	if (!request) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Request not found",
		});
	}

	return request;
}
