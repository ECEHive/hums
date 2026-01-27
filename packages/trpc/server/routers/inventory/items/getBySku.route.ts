import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { Context } from "../../../context";

export const ZGetBySkuItemSchema = z.object({
	sku: z.string(),
});

export type TGetBySkuItemSchema = z.infer<typeof ZGetBySkuItemSchema>;
export type TGetBySkuItemOptions = {
	ctx?: Context;
	input: TGetBySkuItemSchema;
};

export async function getBySkuItemHandler(options: TGetBySkuItemOptions) {
	const { sku } = options.input;
	const item = await prisma.item.findUnique({
		where: { sku },
		include: {
			snapshot: true,
			_count: {
				select: {
					transactions: true,
					requests: true,
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
