import { randomBytes } from "node:crypto";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({});

export type TGenerateSchema = z.infer<typeof ZGenerateSchema>;

export type TGenerateOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TGenerateSchema;
};

/**
 * Generate a new one-time login code
 * Code expires in 5 minutes
 */
export async function generateHandler(_options: TGenerateOptions) {
	// Generate a cryptographically secure random code (8 bytes = 16 hex characters)
	// Try up to 3 times in case of collision (extremely unlikely)
	for (let attempt = 0; attempt < 3; attempt++) {
		const code = randomBytes(8).toString("hex");

		// Code expires in 5 minutes
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

		try {
			const otaCode = await prisma.oneTimeAccessCode.create({
				data: {
					code,
					expiresAt,
				},
			});

			return {
				code: otaCode.code,
				expiresAt: otaCode.expiresAt,
			};
		} catch (error) {
			// If this is a unique constraint violation and not the last attempt, try again
			if (attempt < 2 && error instanceof Error && "code" in error) {
				continue;
			}
			throw error;
		}
	}

	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to generate unique code after multiple attempts",
	});
}
