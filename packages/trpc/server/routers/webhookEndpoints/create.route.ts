import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(100),
	url: z.url("Invalid URL"),
	secret: z.string().min(1).max(100).optional(),
	isActive: z.boolean().optional(),
	sendActions: z.string().array().optional(),
	sendTickets: z.boolean().optional(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { name, url, secret, isActive, sendActions, sendTickets } =
		options.input;

	const webhookEndpoint = await prisma.webhookEndpoint.create({
		data: {
			name,
			url,
			secret,
			isActive: isActive ?? true,
			sendActions: sendActions ?? [],
			sendTickets: sendTickets ?? false,
		},
	});

	if (!webhookEndpoint) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create webhook endpoint",
		});
	}

	return { webhookEndpoint };
}
