import { db, roles, shiftTypeRoles, shiftTypes } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZBulkCreateSchema = z.object({
	shiftTypeId: z.number().min(1),
	roleIds: z.array(z.number().min(1)).min(1),
});

export type TBulkCreateSchema = z.infer<typeof ZBulkCreateSchema>;

export type TBulkCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TBulkCreateSchema;
};

export async function bulkCreateHandler(options: TBulkCreateOptions) {
	const { shiftTypeId, roleIds } = options.input;

	return await db.transaction(async (tx) => {
		// Verify shift type exists
		const [shiftType] = await tx
			.select()
			.from(shiftTypes)
			.where(eq(shiftTypes.id, shiftTypeId))
			.limit(1);

		if (!shiftType) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift type not found",
			});
		}

		// Verify all roles exist
		const existingRoles = await tx
			.select()
			.from(roles)
			.where(inArray(roles.id, roleIds));

		if (existingRoles.length !== roleIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "One or more roles not found",
			});
		}

		// Create all shift type roles
		const created = await tx
			.insert(shiftTypeRoles)
			.values(
				roleIds.map((roleId) => ({
					shiftTypeId,
					roleId,
				})),
			)
			.returning();

		return { shiftTypeRoles: created };
	});
}
