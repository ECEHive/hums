import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(200),
	permissionIds: z.array(z.number().min(1)).optional(),
});
export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

type CreationError = { code?: string };

export async function createHandler(options: TCreateOptions) {
	const { name, permissionIds } = options.input;

	try {
		const role = await prisma.role.create({
			data: {
				name,
				...(permissionIds && permissionIds.length > 0
					? {
							permissions: {
								connect: permissionIds.map((id) => ({ id })),
							},
						}
					: {}),
			},
			include: {
				permissions: {
					orderBy: { name: "asc" },
				},
			},
		});
		return { role };
	} catch (error) {
		if ((error as CreationError).code === "P2002") {
			throw new TRPCError({
				code: "CONFLICT",
				message: `A role with the name "${name}" already exists.`,
			});
		}
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "An unknown error occurred while creating the role.",
		});
	}
}
