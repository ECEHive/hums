import { getSuspension } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({
	id: z.number(),
});

export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const suspension = await getSuspension(prisma, id);

	if (!suspension) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Suspension not found",
		});
	}

	return suspension;
}
