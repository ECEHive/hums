import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(200),
	permissionIds: z.array(z.number().min(1)).optional(),
});
export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, permissionIds } = options.input;

	const updated = await prisma.role.update({
		where: { id },
		data: {
			name,
			...(permissionIds !== undefined
				? {
						permissions: {
							set: permissionIds.map((permissionId) => ({ id: permissionId })),
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

	return { role: updated };
}
