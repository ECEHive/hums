import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdatePermissionsSchema = z.object({
	id: z.number().int().positive(),
	permissionIds: z.array(z.number().int().positive()),
});

export type TUpdatePermissionsSchema = z.infer<typeof ZUpdatePermissionsSchema>;

export type TUpdatePermissionsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUpdatePermissionsSchema;
};

export async function updatePermissionsHandler(
	options: TUpdatePermissionsOptions,
) {
	const { id, permissionIds } = options.input;

	const updated = await prisma.apiToken.update({
		where: { id },
		data: {
			permissions: {
				set: permissionIds.map((permissionId) => ({ id: permissionId })),
			},
		},
		include: { permissions: { orderBy: { name: "asc" } } },
	});

	return { apiToken: updated };
}
