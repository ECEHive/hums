import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZDeleteItemSchema = z.object({
	id: z.string().uuid(),
});

export type TDeleteItemSchema = z.infer<typeof ZDeleteItemSchema>;

export type TDeleteItemOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TDeleteItemSchema;
};

export async function deleteItemHandler(options: TDeleteItemOptions) {
	const { id } = options.input;

	try {
		await prisma.item.delete({
			where: { id },
		});

		return { success: true };
	} catch (_error) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}
}
