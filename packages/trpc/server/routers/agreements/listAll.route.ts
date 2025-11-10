import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListAllSchema = z.object({
	onlyEnabled: z.boolean().default(true),
});

export type TListAllSchema = z.infer<typeof ZListAllSchema>;

export type TListAllOptions = {
	ctx?: TProtectedProcedureContext;
	input: TListAllSchema;
};

export async function listAllHandler(options: TListAllOptions) {
	const { onlyEnabled } = options.input;

	const agreements = await prisma.agreement.findMany({
		where: onlyEnabled ? { isEnabled: true } : undefined,
		orderBy: { createdAt: "desc" },
	});

	return { agreements };
}
