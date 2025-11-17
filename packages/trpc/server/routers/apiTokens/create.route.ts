import { createApiToken } from "@ecehive/features";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().trim().max(250).optional().nullable(),
	expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const expiresAt = options.input.expiresAt
		? new Date(options.input.expiresAt)
		: null;

	const { token, record } = await createApiToken({
		name: options.input.name,
		description: options.input.description ?? null,
		expiresAt,
		createdById: options.ctx.userId,
	});

	return { token, apiToken: record };
}
