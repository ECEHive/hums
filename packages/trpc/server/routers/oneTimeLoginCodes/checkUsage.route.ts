import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZCheckUsageSchema = z.object({
	code: z.string().length(16),
});

export type TCheckUsageSchema = z.infer<typeof ZCheckUsageSchema>;

export type TCheckUsageOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TCheckUsageSchema;
};

/**
 * Check if a one-time login code has been used
 * Used by kiosk to detect when to close the QR code dialog
 */
export async function checkUsageHandler(options: TCheckUsageOptions) {
	const { code } = options.input;

	const otaCode = await prisma.oneTimeAccessCode.findUnique({
		where: { code },
		select: { usedAt: true },
	});

	return {
		used: otaCode?.usedAt !== null && otaCode?.usedAt !== undefined,
	};
}
