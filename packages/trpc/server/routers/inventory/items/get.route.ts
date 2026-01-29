import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { Context } from "../../../context";

export const ZGetItemSchema = z.object({
	id: z.string().uuid(),
});

export type TGetItemSchema = z.infer<typeof ZGetItemSchema>;

export type TGetItemOptions = {
	ctx?: Context;
	input: TGetItemSchema;
};

export async function getItemHandler(options: TGetItemOptions) {
	const { id } = options.input;

	const item = await prisma.item.findUnique({
		where: { id },
		include: {
			snapshot: true,
			approvalRoles: {
				select: { id: true, name: true },
			},
			_count: {
				select: {
					transactions: true,
				},
			},
		},
	});

	if (!item) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}

	return item;
}
