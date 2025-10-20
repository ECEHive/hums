import { db, userRoles } from "@ecehive/drizzle";
import { and, inArray } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteBulkSchema = z.object({
	mappings: z.array(
		z.object({ userId: z.number().min(1), roleId: z.number().min(1) }),
	),
});

export type TDeleteBulkSchema = z.infer<typeof ZDeleteBulkSchema>;

export type TDeleteBulkOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteBulkSchema;
};

export async function deleteBulkHandler(options: TDeleteBulkOptions) {
	const { mappings } = options.input;

	if (mappings.length === 0) return { deleted: 0 };

	const userIds = Array.from(new Set(mappings.map((m) => m.userId)));
	const roleIds = Array.from(new Set(mappings.map((m) => m.roleId)));

	// Find mapping rows that match any of the pairs
	const existing = await db
		.select()
		.from(userRoles)
		.where(
			and(
				inArray(userRoles.userId, userIds),
				inArray(userRoles.roleId, roleIds),
			),
		);

	const toDeleteIds: number[] = [];
	const mappingSet = new Set(
		mappings.map((m) => JSON.stringify([m.userId, m.roleId])),
	);
	existing.forEach((r) => {
		if (mappingSet.has(JSON.stringify([r.userId, r.roleId]))) {
			toDeleteIds.push(r.id);
		}
	});

	if (toDeleteIds.length === 0) return { deleted: 0 };

	const deleted = await db
		.delete(userRoles)
		.where(inArray(userRoles.id, toDeleteIds))
		.returning();

	return { deleted: deleted.length };
}
