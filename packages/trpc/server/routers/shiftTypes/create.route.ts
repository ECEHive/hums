import { db, periods, shiftTypes } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	periodId: z.number().min(1),
	name: z.string().min(1).max(100),
	location: z.string().min(1).max(100),
	description: z.string().min(1).max(2000).optional().nullable(),
	color: z
		.string()
		.regex(/^#([0-9a-fA-F]{3}){1,2}$/)
		.optional()
		.nullable(),
	icon: z.string().min(1).max(100).optional().nullable(),
	isBalancedAcrossOverlap: z.boolean().optional(),
	isBalancedAcrossDay: z.boolean().optional(),
	isBalancedAcrossPeriod: z.boolean().optional(),
	canSelfAssign: z.boolean().optional(),
	doRequireRoles: z.enum(["disabled", "all", "any"]).optional(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const {
		periodId,
		name,
		location,
		description,
		color,
		icon,
		isBalancedAcrossOverlap,
		isBalancedAcrossDay,
		isBalancedAcrossPeriod,
		canSelfAssign,
		doRequireRoles,
	} = options.input;

	const [period] = await db
		.select({ id: periods.id })
		.from(periods)
		.where(eq(periods.id, periodId))
		.limit(1);

	if (!period) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Period not found",
		});
	}

	const values: typeof shiftTypes.$inferInsert = {
		periodId,
		name,
		location,
		description: description ?? null,
		color: color ?? null,
		icon: icon ?? null,
		isBalancedAcrossOverlap: isBalancedAcrossOverlap ?? false,
		isBalancedAcrossDay: isBalancedAcrossDay ?? false,
		isBalancedAcrossPeriod: isBalancedAcrossPeriod ?? false,
		canSelfAssign: canSelfAssign ?? true,
		doRequireRoles: doRequireRoles ?? "disabled",
	};

	const [inserted] = await db.insert(shiftTypes).values(values).returning();

	return { shiftType: inserted };
}
