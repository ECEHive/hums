import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
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
	roleIds: z.array(z.number().min(1)).optional(),
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
		roleIds,
	} = options.input;

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		select: { id: true },
	});

	if (!period) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Period not found",
		});
	}

	const inserted = await prisma.shiftType.create({
		data: {
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
			...(roleIds && roleIds.length > 0
				? {
						roles: {
							connect: roleIds.map((id) => ({ id })),
						},
					}
				: {}),
		},
		include: {
			roles: {
				orderBy: { name: "asc" },
			},
		},
	});

	return { shiftType: inserted };
}
