import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	url: z.url("Invalid URL"),
	secret: z.string().min(1).max(100).optional(),
	isActive: z.boolean().optional(),
	sendActions: z.string().array().optional(),
	sendTickets: z.boolean().optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, url, secret, isActive, sendActions, sendTickets } =
		options.input;

	const webhookEndpoint = await prisma.webhookEndpoint.update({
		where: { id },
		data: {
			name,
			url,
			secret,
			isActive: isActive ?? true,
			sendActions,
			sendTickets,
		},
	});

	if (!webhookEndpoint) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to update webhook endpoint",
		});
	}

	return { webhookEndpoint };
}
