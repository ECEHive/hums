import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z
	.object({
		name: z.string().min(1).max(100),
		start: z.date(),
		end: z.date(),
		min: z.number().int().min(0).optional().nullable(),
		max: z.number().int().min(0).optional().nullable(),
		minMaxUnit: z.enum(["count", "minutes", "hours"]).optional().nullable(),
		visibleStart: z.date(),
		visibleEnd: z.date(),
		scheduleSignupStart: z.date(),
		scheduleSignupEnd: z.date(),
		scheduleModifyStart: z.date(),
		scheduleModifyEnd: z.date(),
		periodRoleIds: z.array(z.number().int().min(1)).default([]),
	})
	.superRefine((data, ctx) => {
		// Start must be before end
		if (data.start >= data.end) {
			ctx.addIssue({
				code: "custom",
				message: "start must be before end",
				path: ["start"],
			});
		}

		// Visible start must be before visible end
		if (data.visibleStart >= data.visibleEnd) {
			ctx.addIssue({
				code: "custom",
				message: "visibleStart must be before visibleEnd",
				path: ["visibleStart"],
			});
		}

		// Schedule signup start must be before signup end
		if (data.scheduleSignupStart >= data.scheduleSignupEnd) {
			ctx.addIssue({
				code: "custom",
				message: "scheduleSignupStart must be before scheduleSignupEnd",
				path: ["scheduleSignupStart"],
			});
		}

		// Schedule modify start must be before modify end
		if (data.scheduleModifyStart >= data.scheduleModifyEnd) {
			ctx.addIssue({
				code: "custom",
				message: "scheduleModifyStart must be before scheduleModifyEnd",
				path: ["scheduleModifyStart"],
			});
		}

		const hasMin = data.min !== null && data.min !== undefined;
		const hasMax = data.max !== null && data.max !== undefined;

		if ((hasMin || hasMax) && !data.minMaxUnit) {
			ctx.addIssue({
				code: "custom",
				message: "Select a unit when specifying min or max",
				path: ["minMaxUnit"],
			});
		}

		if (
			hasMin &&
			hasMax &&
			typeof data.min === "number" &&
			typeof data.max === "number"
		) {
			if (data.min > data.max) {
				ctx.addIssue({
					code: "custom",
					message: "Minimum requirement cannot exceed maximum",
					path: ["min"],
				});
			}
		}
	});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const {
		name,
		start,
		end,
		min,
		max,
		minMaxUnit,
		visibleStart,
		visibleEnd,
		scheduleSignupStart,
		scheduleSignupEnd,
		scheduleModifyStart,
		scheduleModifyEnd,
		periodRoleIds,
	} = options.input;

	const uniqueRoleIds = Array.from(new Set(periodRoleIds ?? []));

	return await prisma.$transaction(async (tx) => {
		const inserted = await tx.period.create({
			data: {
				name,
				start,
				end,
				min: min ?? null,
				max: max ?? null,
				minMaxUnit: minMaxUnit ?? null,
				visibleStart,
				visibleEnd,
				scheduleSignupStart,
				scheduleSignupEnd,
				scheduleModifyStart,
				scheduleModifyEnd,
				roles: uniqueRoleIds.length
					? {
							connect: uniqueRoleIds.map((roleId) => ({ id: roleId })),
						}
					: undefined,
			},
		});

		if (!inserted) {
			return { period: undefined };
		}

		// Generate shift occurrences for all schedules in this period
		await generatePeriodShiftOccurrences(tx, inserted.id);

		const periodWithRoles = await tx.period.findUnique({
			where: { id: inserted.id },
			include: {
				roles: true,
			},
		});

		return { period: periodWithRoles ?? inserted };
	});
}
