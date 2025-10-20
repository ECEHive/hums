import { db, userRoles } from "@ecehive/drizzle";
import { and, inArray, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateBulkSchema = z.object({
	mappings: z.array(
		z.object({ userId: z.number().min(1), roleId: z.number().min(1) }),
	),
});

export type TCreateBulkSchema = z.infer<typeof ZCreateBulkSchema>;

export type TCreateBulkOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateBulkSchema;
};

export async function createBulkHandler(options: TCreateBulkOptions) {
	const { mappings } = options.input;

	if (mappings.length === 0) {
		return { created: 0 };
	}

	// Prepare unique lists to query existing entries efficiently
	const userIds = Array.from(new Set(mappings.map((m) => m.userId)));
	const roleIds = Array.from(new Set(mappings.map((m) => m.roleId)));

	const filters = [] as (SQL | undefined)[];
	filters.push(inArray(userRoles.userId, userIds));
	filters.push(inArray(userRoles.roleId, roleIds));

	const existing = await db
		.select()
		.from(userRoles)
		.where(and(...filters));

	const existingSet = new Set<string>();
	existing.forEach((r) => {
		existingSet.add(JSON.stringify([r.userId, r.roleId]));
	});

	// Build unique to-insert mappings (avoid duplicates in input)
	const toInsertMap = new Map<string, { userId: number; roleId: number }>();
	for (const m of mappings) {
		const key = JSON.stringify([m.userId, m.roleId]);
		if (!existingSet.has(key) && !toInsertMap.has(key)) {
			toInsertMap.set(key, { userId: m.userId, roleId: m.roleId });
			existingSet.add(key);
		}
	}

	const toInsert = Array.from(toInsertMap.values());

	if (toInsert.length === 0) return { created: 0 };

	const inserted = await db.insert(userRoles).values(toInsert).returning();

	return { created: inserted.length };
}
